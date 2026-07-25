"""Reusable ScoutAI machine-learning engine.

This module is a direct extraction of the data preparation, tuning, dynamic
feature weighting, and five recommendation algorithms from ``ai.ipynb``.
Notebook-only presentation code (widgets, printing, and charts) is deliberately
left out so callers can receive JSON-serializable results.
"""

from __future__ import annotations

import argparse
import json
import warnings
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN, KMeans
from sklearn.metrics import silhouette_score
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import GridSearchCV
from sklearn.neighbors import KNeighborsClassifier, NearestNeighbors
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


warnings.filterwarnings("ignore")

DEFAULT_DATASET_PATH = Path(__file__).with_name("fm_dataset.csv")

# Kept in the same order as the notebook because the weights are applied by
# feature index.
ALL_USER_COLUMNS = [
    "Name",
    "Position",
    "Age",
    "ca",
    "pa",
    "Nationality",
    "Club",
    "Corners",
    "Crossing",
    "Dribbling",
    "Finishing",
    "First Touch",
    "Free Kick Taking",
    "Heading",
    "Long Shots",
    "Long Throws",
    "Marking",
    "Passing",
    "Penalty Taking",
    "Tackling",
    "Technique",
    "Aggression",
    "Anticipation",
    "Bravery",
    "Composure",
    "Concentration",
    "Vision",
    "Decisions",
    "Determination",
    "Flair",
    "Leadership",
    "Off The Ball",
    "Positioning",
    "Teamwork",
    "Work Rate",
    "Acceleration",
    "Agility",
    "Balance",
    "Jumping Reach",
    "Natural Fitness",
    "Pace",
    "Stamina",
    "Strength",
    "Stability",
    "Foul",
    "Contest performance",
    "Injury",
    "diversity",
    "Aerial Reach",
    "Command Of Area",
    "Communication",
    "Eccentricity",
    "Handling",
    "Kicking",
    "One On Ones",
    "Reflexes",
    "Rushing Out",
    "Punching",
    "Throwing",
    "Adaptation",
    "Ambition",
    "Argue",
    "Loyal",
    "Resistant to stress",
    "Professional",
    "Sportsmanship",
    "Emotional control",
    "GK",
    "DL",
    "DC",
    "DR",
    "WBL",
    "WBR",
    "DM",
    "ML",
    "MC",
    "MR",
    "AML",
    "AMC",
    "AMR",
    "ST",
    "Height",
    "Weight",
    "Left Foot",
    "Right Foot",
    "Values",
    "Current reputation",
    "Domestic reputation",
    "World reputation",
    "Race",
    "RCA",
    "Colour of skin",
    "Date of birth",
    "Number of national team appearances",
    "Goals scored for the national team",
    "Salary",
    "Rental club",
    "UID",
]

CATEGORICAL_COLUMNS = [
    "Name",
    "Position",
    "Nationality",
    "Club",
    "Race",
    "Colour of skin",
    "Date of birth",
    "Rental club",
    "UID",
]

ML_FEATURES = [
    column for column in ALL_USER_COLUMNS if column not in CATEGORICAL_COLUMNS
]

FINANCE_COLUMNS = [
    "Values",
    "Salary",
    "Current reputation",
    "Domestic reputation",
    "World reputation",
]
NATIONAL_COLUMNS = [
    "Number of national team appearances",
    "Goals scored for the national team",
]
HIDDEN_COLUMNS = [
    "Adaptation",
    "Ambition",
    "Argue",
    "Loyal",
    "Resistant to stress",
    "Professional",
    "Sportsmanship",
    "Emotional control",
]
GOALKEEPER_COLUMNS = [
    "Aerial Reach",
    "Command Of Area",
    "Communication",
    "Eccentricity",
    "Handling",
    "Kicking",
    "One On Ones",
    "Reflexes",
    "Rushing Out",
    "Punching",
    "Throwing",
]
OUTFIELD_COLUMNS = [
    "Finishing",
    "Dribbling",
    "Crossing",
    "Long Throws",
    "Corners",
    "Free Kick Taking",
    "Penalty Taking",
    "Heading",
    "Long Shots",
]

MODEL_NAMES = [
    "K-NN (The Clone)",
    "Cosine (Style Match)",
    "Radius NN (Strict Filter)",
    "K-Means (Tactical Group)",
    "DBSCAN (Outlier Detector)",
]


class ScoutEngineError(Exception):
    """Base exception for errors callers can convert into an API response."""


class PlayerNotFoundError(ScoutEngineError):
    """Raised when the requested player name is not in the dataset."""


class AmbiguousPlayerError(ScoutEngineError):
    """Raised when a partial name matches more than one player."""

    def __init__(self, search_name: str, matches: list[dict[str, Any]]) -> None:
        super().__init__(
            f"Found multiple players matching '{search_name}'. "
            "Please provide the full player name."
        )
        self.search_name = search_name
        self.matches = matches


def _native_number(value: Any) -> int | float:
    """Convert NumPy scalars to values that Python's JSON encoder accepts."""

    return value.item() if isinstance(value, np.generic) else value


class ScoutEngine:
    """Load ScoutAI data once and expose the notebook recommendation logic."""

    def __init__(self, dataset_path: str | Path = DEFAULT_DATASET_PATH) -> None:
        self.dataset_path = Path(dataset_path).resolve()
        self.df = self._load_and_prepare_dataset()

        self.available_ml_features = [
            column for column in ML_FEATURES if column in self.df.columns
        ]
        self.x_raw = self.df[self.available_ml_features].values

        self.scaler = StandardScaler()
        self.x_scaled = self.scaler.fit_transform(self.x_raw)

        (
            self.best_k_knn,
            self.best_knn_accuracy,
            self.best_k_kmeans,
            self.silhouette_scores,
        ) = self._tune_hyperparameters()

    def _load_and_prepare_dataset(self) -> pd.DataFrame:
        """Run the notebook's loading and cleaning steps without modification."""

        if not self.dataset_path.is_file():
            raise FileNotFoundError(
                f"Dataset file not found: {self.dataset_path}"
            )

        df = pd.read_csv(self.dataset_path, low_memory=False)

        # Handle missing values globally.
        df = df.replace("-", np.nan)

        # Clean characters and handle missing values for ML features.
        for column in ML_FEATURES:
            if column in df.columns:
                df[column] = (
                    df[column]
                    .astype(str)
                    .str.replace(r"[^\d.-]", "", regex=True)
                )
                df[column] = pd.to_numeric(
                    df[column], errors="coerce"
                ).fillna(0)

        df["Name"] = df["Name"].fillna("Unknown")
        df["Club"] = df["Club"].fillna("Free Agent")
        if "UID" in df.columns:
            df["UID"] = df["UID"].fillna(0).astype(int).astype(str)
        else:
            df["UID"] = df.index.astype(str)
        df["Display_Name"] = df["Name"] + " (" + df["Club"] + ")"

        # Create the same proxy target used by GridSearch in the notebook.
        df["Gen_Pos"] = (
            df["Position"]
            .astype(str)
            .str.split("/")
            .str[0]
            .str.split()
            .str[0]
            .str.replace(r"[^a-zA-Z]", "", regex=True)
        )
        df["Gen_Pos"] = df["Gen_Pos"].replace({"": "Unknown"})

        return df

    def _tune_hyperparameters(
        self,
    ) -> tuple[int, float, int, dict[int, float]]:
        """Run the notebook's GridSearch and silhouette analysis."""

        np.random.seed(42)

        pipeline = Pipeline(
            [
                ("scaler", StandardScaler()),
                ("knn", KNeighborsClassifier()),
            ]
        )
        param_grid_knn = {"knn__n_neighbors": [1, 3, 5, 7, 10]}
        grid_knn = GridSearchCV(
            pipeline,
            param_grid_knn,
            cv=3,
            scoring="accuracy",
            n_jobs=-1,
        )

        sample_size = min(3000, len(self.df))
        sample_idx = np.random.choice(
            len(self.df), sample_size, replace=False
        )

        grid_knn.fit(
            self.x_raw[sample_idx],
            self.df.iloc[sample_idx]["Gen_Pos"],
        )
        best_k_knn = int(grid_knn.best_params_["knn__n_neighbors"])
        best_knn_accuracy = float(grid_knn.best_score_ * 100)

        k_values = [5, 10, 15, 20]
        silhouette_scores = []
        for k in k_values:
            kmeans_temp = KMeans(
                n_clusters=k,
                random_state=42,
                n_init="auto",
            )
            labels_temp = kmeans_temp.fit_predict(
                self.x_scaled[sample_idx]
            )
            score = silhouette_score(
                self.x_scaled[sample_idx], labels_temp
            )
            silhouette_scores.append(float(score))

        best_k_kmeans = int(k_values[np.argmax(silhouette_scores)])

        return (
            best_k_knn,
            best_knn_accuracy,
            best_k_kmeans,
            dict(zip(k_values, silhouette_scores)),
        )

    def _find_target_index(self, search_name: str) -> int:
        """Apply the notebook's partial/exact name disambiguation behavior."""

        target_matches = self.df[
            self.df["Name"].str.contains(
                str(search_name), case=False, na=False
            )
        ]

        if len(target_matches) == 0:
            raise PlayerNotFoundError(
                f"Target player '{search_name}' not found. "
                "Please try another name."
            )

        if len(target_matches) > 1:
            exact_match = target_matches[
                target_matches["Name"].str.lower()
                == str(search_name).lower()
            ]
            if len(exact_match) == 1:
                return int(exact_match.index[0])

            matches = [
                {
                    "Name": row["Name"],
                    "Club": row["Club"],
                }
                for _, row in target_matches.head(5).iterrows()
            ]
            raise AmbiguousPlayerError(str(search_name), matches)

        return int(target_matches.index[0])

    @staticmethod
    def _distance_to_percentage(
        distance: float, max_distance: float = 15.0
    ) -> float:
        """Use the notebook's unchanged distance-to-percentage formula."""

        return float(
            np.clip(
                100 - (distance / max_distance) * 100,
                0,
                100,
            )
        )

    def recommend(self, search_name: str) -> dict[str, Any]:
        """Return the notebook's Top 5 results from all five ML engines."""

        target_idx = self._find_target_index(search_name)
        target_player = self.df.iloc[target_idx]

        candidates_idx = self.df.index != target_idx
        x_candidates = self.x_scaled[candidates_idx]
        candidate_df = self.df[candidates_idx].reset_index(drop=True)
        target_vector = self.x_scaled[target_idx].reshape(1, -1)

        # Dynamic Feature Weighting, kept in the notebook's original order.
        weights = np.ones(target_vector.shape[1])
        is_goalkeeper = target_player["Gen_Pos"] == "GK"

        for index, column in enumerate(self.available_ml_features):
            if column in FINANCE_COLUMNS:
                weights[index] = 0.20
            elif column in NATIONAL_COLUMNS:
                weights[index] = 0.10
            elif column in HIDDEN_COLUMNS:
                weights[index] = 0.50

            if is_goalkeeper:
                if column in OUTFIELD_COLUMNS:
                    weights[index] = 0.01
                elif column in GOALKEEPER_COLUMNS:
                    weights[index] = 2.00
            elif column in GOALKEEPER_COLUMNS:
                weights[index] = 0.01

        base_weighted_target = target_vector[0] * weights
        top_5_idx = np.argsort(base_weighted_target)[-5:]
        weights[top_5_idx] *= 1.5

        target_weighted = target_vector * weights
        x_candidates_weighted = x_candidates * weights

        top_5_results: dict[str, list[dict[str, Any]]] = {}

        # 1. K-Nearest Neighbors
        knn = NearestNeighbors(n_neighbors=5, metric="euclidean")
        knn.fit(x_candidates_weighted)
        distances_knn, indices_knn = knn.kneighbors(target_weighted)
        top_5_results[MODEL_NAMES[0]] = [
            {
                "Name": candidate_df.iloc[indices_knn[0][i]]["Name"],
                "Score": self._distance_to_percentage(
                    distances_knn[0][i]
                ),
                "Age": _native_number(
                    candidate_df.iloc[indices_knn[0][i]]["Age"]
                ),
                "CA": _native_number(
                    candidate_df.iloc[indices_knn[0][i]]["ca"]
                ),
            }
            for i in range(5)
        ]

        # 2. Cosine Similarity
        similarity_matrix = cosine_similarity(
            target_weighted, x_candidates_weighted
        )[0]
        cosine_indices = np.argsort(similarity_matrix)[::-1][:5]
        top_5_results[MODEL_NAMES[1]] = [
            {
                "Name": candidate_df.iloc[i]["Name"],
                "Score": float(
                    np.clip(similarity_matrix[i] * 100, 0, 100)
                ),
                "Age": _native_number(candidate_df.iloc[i]["Age"]),
                "CA": _native_number(candidate_df.iloc[i]["ca"]),
            }
            for i in cosine_indices
        ]

        # 3. Radius Nearest Neighbors
        radius_nn = NearestNeighbors(radius=15.0, metric="euclidean")
        radius_nn.fit(x_candidates_weighted)
        distances_radius, indices_radius = radius_nn.radius_neighbors(
            target_weighted, sort_results=True
        )
        top_5_results[MODEL_NAMES[2]] = [
            {
                "Name": candidate_df.iloc[indices_radius[0][i]]["Name"],
                "Score": self._distance_to_percentage(
                    distances_radius[0][i]
                ),
                "Age": _native_number(
                    candidate_df.iloc[indices_radius[0][i]]["Age"]
                ),
                "CA": _native_number(
                    candidate_df.iloc[indices_radius[0][i]]["ca"]
                ),
            }
            for i in range(min(5, len(indices_radius[0])))
        ]

        # 4. K-Means
        kmeans = KMeans(
            n_clusters=self.best_k_kmeans,
            random_state=42,
            n_init=10,
        )
        kmeans_labels = kmeans.fit_predict(
            np.vstack([target_weighted, x_candidates_weighted])
        )
        same_cluster = np.where(
            kmeans_labels[1:] == kmeans_labels[0]
        )[0]

        kmeans_list: list[dict[str, Any]] = []
        if len(same_cluster) > 0:
            distances_kmeans = np.linalg.norm(
                x_candidates_weighted[same_cluster] - target_weighted,
                axis=1,
            )
            sorted_sub_indices = np.argsort(distances_kmeans)[:5]
            kmeans_list = [
                {
                    "Name": candidate_df.iloc[same_cluster[i]]["Name"],
                    "Score": self._distance_to_percentage(
                        distances_kmeans[i]
                    ),
                    "Age": _native_number(
                        candidate_df.iloc[same_cluster[i]]["Age"]
                    ),
                    "CA": _native_number(
                        candidate_df.iloc[same_cluster[i]]["ca"]
                    ),
                }
                for i in sorted_sub_indices
            ]
        top_5_results[MODEL_NAMES[3]] = kmeans_list

        # 5. DBSCAN with the same dynamic epsilon.
        dynamic_epsilon = float(np.mean(distances_knn[0]) * 1.2)
        dbscan = DBSCAN(eps=dynamic_epsilon, min_samples=2)
        dbscan_labels = dbscan.fit_predict(
            np.vstack([target_weighted, x_candidates_weighted])
        )

        if dbscan_labels[0] == -1:
            top_5_results[MODEL_NAMES[4]] = [
                {
                    "Name": f"🚨 OUTLIER (Eps: {dynamic_epsilon:.1f})",
                    "Score": 0,
                    "Age": 0,
                    "CA": 0,
                }
            ]
        else:
            same_dbscan_cluster = np.where(
                dbscan_labels[1:] == dbscan_labels[0]
            )[0]
            distances_dbscan = np.linalg.norm(
                x_candidates_weighted[same_dbscan_cluster]
                - target_weighted,
                axis=1,
            )
            sorted_sub_indices = np.argsort(distances_dbscan)[:5]
            top_5_results[MODEL_NAMES[4]] = [
                {
                    "Name": candidate_df.iloc[
                        same_dbscan_cluster[i]
                    ]["Name"],
                    "Score": self._distance_to_percentage(
                        distances_dbscan[i]
                    ),
                    "Age": _native_number(
                        candidate_df.iloc[
                            same_dbscan_cluster[i]
                        ]["Age"]
                    ),
                    "CA": _native_number(
                        candidate_df.iloc[
                            same_dbscan_cluster[i]
                        ]["ca"]
                    ),
                }
                for i in sorted_sub_indices
            ]

        return {
            "target": {
                "Name": target_player["Name"],
                "Display_Name": target_player["Display_Name"],
                "Position": target_player["Gen_Pos"],
                "Age": _native_number(target_player["Age"]),
                "MarketValue": _native_number(target_player["Values"]),
                "UID": target_player["UID"],
            },
            "results": top_5_results,
            "model": {
                "bestKnnK": self.best_k_knn,
                "bestKnnAccuracy": self.best_knn_accuracy,
                "bestKMeansK": self.best_k_kmeans,
                "dynamicEpsilon": dynamic_epsilon,
                "featureCount": len(self.available_ml_features),
            },
        }


@lru_cache(maxsize=1)
def get_default_engine() -> ScoutEngine:
    """Create one shared engine instance for API processes."""

    return ScoutEngine(DEFAULT_DATASET_PATH)


def recommend_players(search_name: str) -> dict[str, Any]:
    """Convenience function intended for the future API layer."""

    return get_default_engine().recommend(search_name)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the ScoutAI player recommendation engine."
    )
    parser.add_argument("player_name", help="Full or partial player name")
    parser.add_argument(
        "--dataset",
        default=str(DEFAULT_DATASET_PATH),
        help="Path to fm_dataset.csv",
    )
    args = parser.parse_args()

    try:
        result = ScoutEngine(args.dataset).recommend(args.player_name)
    except AmbiguousPlayerError as error:
        print(
            json.dumps(
                {
                    "error": str(error),
                    "matches": error.matches,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 2
    except (PlayerNotFoundError, FileNotFoundError) as error:
        print(
            json.dumps(
                {"error": str(error)},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
