"""Tests for the FastAPI layer without rerunning the real ML pipeline."""

import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient


PROJECT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_DIR))

from ScoutAI.api import create_app  # noqa: E402
from ScoutAI.scout_engine import (  # noqa: E402
    AmbiguousPlayerError,
    PlayerNotFoundError,
)


class FakeEngine:
    def __init__(self):
        self.df = [object(), object()]
        self.available_ml_features = ["Age", "Passing"]
        self.best_k_knn = 7
        self.best_k_kmeans = 10
        self.received_names = []

    def recommend(self, player_name):
        self.received_names.append(player_name)

        if player_name == "Unknown":
            raise PlayerNotFoundError("Target player 'Unknown' not found.")
        if player_name == "Mohamed":
            raise AmbiguousPlayerError(
                player_name,
                [
                    {"Name": "Mohamed Salah", "Club": "Liverpool"},
                    {"Name": "Mohamed Elneny", "Club": "Arsenal"},
                ],
            )

        return {
            "target": {"Name": player_name},
            "results": {"K-NN (The Clone)": []},
            "model": {"bestKnnK": 7, "bestKMeansK": 10},
        }


class ScoutApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = FakeEngine()
        self.app = create_app(engine_factory=lambda: self.engine)
        self.client_context = TestClient(self.app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)

    def test_health_reports_loaded_engine(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "status": "ok",
                "engine": "ready",
                "datasetRows": 2,
                "featureCount": 2,
                "bestKnnK": 7,
                "bestKMeansK": 10,
            },
        )

    def test_recommend_returns_engine_result(self):
        response = self.client.post(
            "/v1/recommend",
            json={"playerName": "  Kevin De Bruyne  "},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["target"]["Name"],
            "Kevin De Bruyne",
        )
        self.assertEqual(
            self.engine.received_names,
            ["Kevin De Bruyne"],
        )

    def test_unknown_player_returns_404(self):
        response = self.client.post(
            "/v1/recommend",
            json={"playerName": "Unknown"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json()["detail"]["code"],
            "PLAYER_NOT_FOUND",
        )

    def test_ambiguous_name_returns_candidates(self):
        response = self.client.post(
            "/v1/recommend",
            json={"playerName": "Mohamed"},
        )

        self.assertEqual(response.status_code, 409)
        detail = response.json()["detail"]
        self.assertEqual(detail["code"], "AMBIGUOUS_PLAYER_NAME")
        self.assertEqual(len(detail["matches"]), 2)

    def test_blank_name_returns_422_without_calling_engine(self):
        response = self.client.post(
            "/v1/recommend",
            json={"playerName": "   "},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()["detail"]["code"],
            "INVALID_PLAYER_NAME",
        )
        self.assertEqual(self.engine.received_names, [])

    def test_missing_name_uses_fastapi_validation(self):
        response = self.client.post("/v1/recommend", json={})

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
