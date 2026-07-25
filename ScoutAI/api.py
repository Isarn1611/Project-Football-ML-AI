"""HTTP API for the reusable ScoutAI machine-learning engine."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, Callable

from fastapi import FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field

from ScoutAI.scout_engine import (
    AmbiguousPlayerError,
    PlayerNotFoundError,
    ScoutEngine,
)


class RecommendationRequest(BaseModel):
    """Input accepted by the recommendation endpoint."""

    playerName: str = Field(
        min_length=1,
        max_length=200,
        examples=["Kevin De Bruyne"],
    )


class HealthResponse(BaseModel):
    """Readiness information for callers and container health checks."""

    status: str
    engine: str
    datasetRows: int
    featureCount: int
    bestKnnK: int
    bestKMeansK: int


def create_app(
    engine_factory: Callable[[], ScoutEngine] = ScoutEngine,
) -> FastAPI:
    """Build the API and load exactly one engine for its lifespan."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.engine = engine_factory()
        yield
        app.state.engine = None

    app = FastAPI(
        title="ScoutAI ML API",
        description=(
            "HTTP interface for the unchanged ScoutAI notebook "
            "recommendation logic."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )

    def get_engine(request: Request) -> ScoutEngine:
        engine = getattr(request.app.state, "engine", None)
        if engine is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "ENGINE_NOT_READY",
                    "message": "ScoutAI engine is not ready.",
                },
            )
        return engine

    @app.get("/health", response_model=HealthResponse)
    def health(request: Request) -> dict[str, Any]:
        engine = get_engine(request)
        return {
            "status": "ok",
            "engine": "ready",
            "datasetRows": len(engine.df),
            "featureCount": len(engine.available_ml_features),
            "bestKnnK": engine.best_k_knn,
            "bestKMeansK": engine.best_k_kmeans,
        }

    @app.post("/v1/recommend")
    def recommend(
        payload: RecommendationRequest,
        request: Request,
    ) -> dict[str, Any]:
        player_name = payload.playerName.strip()
        if not player_name:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "INVALID_PLAYER_NAME",
                    "message": "playerName must not be blank.",
                },
            )

        engine = get_engine(request)
        try:
            return engine.recommend(player_name)
        except PlayerNotFoundError as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "PLAYER_NOT_FOUND",
                    "message": str(error),
                },
            ) from error
        except AmbiguousPlayerError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "AMBIGUOUS_PLAYER_NAME",
                    "message": str(error),
                    "matches": error.matches,
                },
            ) from error

    return app


app = create_app()
