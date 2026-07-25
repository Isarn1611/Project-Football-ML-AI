"""Regression tests proving scout_engine matches the current notebook."""

import json
import os
import sys
import unittest
from pathlib import Path

import matplotlib


matplotlib.use("Agg")

SCOUTAI_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = SCOUTAI_DIR.parent
sys.path.insert(0, str(PROJECT_DIR))

from ScoutAI.scout_engine import (  # noqa: E402
    AmbiguousPlayerError,
    MODEL_NAMES,
    PlayerNotFoundError,
    ScoutEngine,
)


def run_notebook_reference(player_name):
    """Execute the ML cells from ai.ipynb and return their raw results."""

    with (SCOUTAI_DIR / "ai.ipynb").open(encoding="utf-8") as notebook_file:
        notebook = json.load(notebook_file)

    code_cells = {
        index: "".join(cell["source"])
        for index, cell in enumerate(notebook["cells"])
        if cell["cell_type"] == "code"
    }
    namespace = {}
    previous_directory = Path.cwd()

    try:
        os.chdir(SCOUTAI_DIR)
        for cell_index in (1, 3, 5, 7):
            exec(
                compile(
                    code_cells[cell_index],
                    f"ai.ipynb:cell-{cell_index}",
                    "exec",
                ),
                namespace,
            )

        namespace["plt"].show = lambda: None
        exec(
            compile(code_cells[9], "ai.ipynb:cell-9", "exec"),
            namespace,
        )

        recommendation_source = code_cells[11].split(
            "    # --- Visual Analytics ---",
            maxsplit=1,
        )[0]
        recommendation_source += "    return top5_results\n"
        exec(
            compile(
                recommendation_source,
                "ai.ipynb:cell-11-recommendation",
                "exec",
            ),
            namespace,
        )

        results = namespace["run_scouting_radar"](player_name)
        tuning = {
            "bestKnnK": namespace["best_k_knn"],
            "bestKnnAccuracy": namespace["best_knn_acc"],
            "bestKMeansK": namespace["best_k_kmeans"],
            "featureCount": len(namespace["available_ml_features"]),
        }
        return results, tuning
    finally:
        os.chdir(previous_directory)


class ScoutEngineParityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = ScoutEngine()
        cls.engine_result = cls.engine.recommend("Kevin De Bruyne")
        cls.notebook_results, cls.notebook_tuning = run_notebook_reference(
            "Kevin De Bruyne"
        )

    def test_results_match_notebook(self):
        self.assertEqual(
            list(self.engine_result["results"]),
            MODEL_NAMES,
        )

        for model_name in MODEL_NAMES:
            engine_players = self.engine_result["results"][model_name]
            notebook_players = self.notebook_results[model_name]
            self.assertEqual(
                [player["Name"] for player in engine_players],
                [player["Name"] for player in notebook_players],
            )
            self.assertEqual(
                [player["Age"] for player in engine_players],
                [player["Age"] for player in notebook_players],
            )
            self.assertEqual(
                [player["CA"] for player in engine_players],
                [player["CA"] for player in notebook_players],
            )
            for engine_player, notebook_player in zip(
                engine_players, notebook_players
            ):
                self.assertAlmostEqual(
                    engine_player["Score"],
                    notebook_player["Score"],
                    places=10,
                )

    def test_tuning_matches_notebook(self):
        for key, expected in self.notebook_tuning.items():
            self.assertAlmostEqual(
                self.engine_result["model"][key],
                expected,
                places=10,
            )

    def test_result_is_json_serializable(self):
        json.dumps(self.engine_result, ensure_ascii=False)

    def test_unknown_player_has_a_structured_error(self):
        with self.assertRaises(PlayerNotFoundError):
            self.engine.recommend("__PLAYER_THAT_DOES_NOT_EXIST__")

    def test_player_name_lookup_works_without_accents(self):
        result = self.engine.recommend("Kylian Mbappe")

        self.assertEqual(result["target"]["Name"], "Kylian Mbappé")
        self.assertEqual(len(result["results"]), 5)

    def test_partial_name_can_request_disambiguation(self):
        with self.assertRaises(AmbiguousPlayerError) as context:
            self.engine.recommend("Mohamed")
        self.assertGreater(len(context.exception.matches), 1)
        self.assertLessEqual(len(context.exception.matches), 5)


if __name__ == "__main__":
    unittest.main()
