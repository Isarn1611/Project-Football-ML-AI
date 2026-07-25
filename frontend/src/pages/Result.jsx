import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  clearRecommendationCache,
  getRecommendations,
} from "../services/api";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const modelStyles = [
  {
    badge: "Clone finder",
    color: "bg-emerald-300",
    text: "text-emerald-300",
    border: "border-emerald-300/20",
  },
  {
    badge: "Style match",
    color: "bg-cyan-300",
    text: "text-cyan-300",
    border: "border-cyan-300/20",
  },
  {
    badge: "Strict radius",
    color: "bg-violet-300",
    text: "text-violet-300",
    border: "border-violet-300/20",
  },
  {
    badge: "Tactical group",
    color: "bg-amber-300",
    text: "text-amber-300",
    border: "border-amber-300/20",
  },
  {
    badge: "Outlier check",
    color: "bg-rose-300",
    text: "text-rose-300",
    border: "border-rose-300/20",
  },
];

function formatValue(value) {
  return value === null || value === undefined || value === ""
    ? "—"
    : value;
}

function formatCurrency(value) {
  return value === null || value === undefined
    ? "—"
    : currencyFormatter.format(value);
}

function normalizeScore(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 0;
  return Math.max(0, Math.min(100, numericScore));
}

function readApiError(error) {
  const payload = error.response?.data;
  return {
    status: error.response?.status,
    code: payload?.code || "REQUEST_FAILED",
    message:
      payload?.message ||
      "Could not complete the scouting analysis. Check that both APIs are running.",
    matches: payload?.details?.matches || [],
  };
}

function LoadingState({ playerName }) {
  return (
    <div
      aria-live="polite"
      className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center text-center"
    >
      <div className="relative mb-8 h-20 w-20">
        <div className="absolute inset-0 rounded-full border border-emerald-300/20" />
        <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-emerald-300" />
        <div className="absolute inset-0 grid place-items-center text-xs font-black text-emerald-300">
          ML
        </div>
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">
        Five engines running
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
        Analyzing {playerName}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Comparing 89 weighted attributes across the global player dataset.
      </p>
    </div>
  );
}

function ErrorState({ error, onRetry, onSelectPlayer }) {
  const hasMatches = error.matches.length > 0;

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-rose-300/20 bg-rose-300/[0.06] p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-300">
        {hasMatches ? "Choose a player" : "Analysis unavailable"}
      </p>
      <h1 className="mt-3 text-2xl font-bold text-white">
        {hasMatches
          ? "That name matches more than one player."
          : error.message}
      </h1>

      {hasMatches ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {error.matches.map((match) => (
            <button
              className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-emerald-300/40 hover:bg-emerald-300/[0.06]"
              key={`${match.Name}-${match.Club}`}
              onClick={() => onSelectPlayer(match.Name)}
              type="button"
            >
              <span className="block font-semibold text-white">
                {match.Name}
              </span>
              <span className="mt-1 block text-sm text-slate-400">
                {formatValue(match.Club)}
              </span>
            </button>
          ))}
        </div>
      ) : error.code === "MISSING_PLAYER" ? (
        <Link
          className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-200"
          to="/"
        >
          Choose a player
        </Link>
      ) : (
        <button
          className="mt-6 rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-200"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function ModelCard({ modelName, players, style }) {
  return (
    <article
      className={`overflow-hidden rounded-2xl border ${style.border} bg-white/[0.045]`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-[0.2em] ${style.text}`}
          >
            {style.badge}
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">{modelName}</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-slate-400">
          Top {players.length}
        </span>
      </header>

      {players.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-400">
          No player passed this model&apos;s matching criteria.
        </p>
      ) : (
        <ol className="divide-y divide-white/[0.07]">
          {players.map((player, index) => {
            const score = normalizeScore(player.Score);
            const isOutlier = String(player.Name).includes("OUTLIER");

            return (
              <li
                className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-5 py-4"
                key={`${player.Name}-${index}`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] text-xs font-bold text-slate-400">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p
                      className={`truncate font-semibold ${
                        isOutlier ? "text-rose-200" : "text-white"
                      }`}
                    >
                      {player.Name}
                    </p>
                    <p className={`shrink-0 text-sm font-bold ${style.text}`}>
                      {score.toFixed(1)}%
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      aria-label={`${player.Name} similarity ${score.toFixed(1)} percent`}
                      aria-valuemax="100"
                      aria-valuemin="0"
                      aria-valuenow={score}
                      className={`h-full rounded-full ${style.color}`}
                      role="progressbar"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
                <div className="hidden min-w-16 text-right text-xs text-slate-500 sm:block">
                  <span className="block">Age {formatValue(player.Age)}</span>
                  <span className="mt-1 block">
                    CA {formatValue(player.CA)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

function Result() {
  const [searchParams, setSearchParams] = useSearchParams();
  const playerName = searchParams.get("player")?.trim() || "";
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${playerName}:${reloadToken}`;
  const [requestState, setRequestState] = useState({
    key: "",
    status: "idle",
    result: null,
    error: null,
  });

  useEffect(() => {
    let isActive = true;

    if (!playerName) {
      return () => {
        isActive = false;
      };
    }

    getRecommendations(playerName)
      .then((data) => {
        if (isActive) {
          setRequestState({
            key: requestKey,
            status: "success",
            result: data,
            error: null,
          });
        }
      })
      .catch((requestError) => {
        if (isActive) {
          setRequestState({
            key: requestKey,
            status: "error",
            result: null,
            error: readApiError(requestError),
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [playerName, requestKey]);

  const currentState = !playerName
    ? {
        status: "error",
        result: null,
        error: {
          code: "MISSING_PLAYER",
          message: "No player was selected for analysis.",
          matches: [],
        },
      }
    : requestState.key === requestKey
      ? requestState
      : {
          status: "loading",
          result: null,
          error: null,
        };

  const models = useMemo(
    () => Object.entries(currentState.result?.results || {}),
    [currentState.result]
  );

  function retry() {
    clearRecommendationCache(playerName);
    setReloadToken((value) => value + 1);
  }

  function selectPlayer(name) {
    setSearchParams({ player: name });
  }

  return (
    <main className="min-h-screen bg-[#07110d] text-slate-100">
      <div className="border-b border-white/10 bg-black/15">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link
            className="flex items-center gap-3 text-white transition hover:text-emerald-200"
            to="/"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 text-xs font-black text-emerald-300">
              SA
            </span>
            <span className="font-bold">ScoutAI</span>
          </Link>
          <Link
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-emerald-300/40 hover:text-emerald-200"
            to="/"
          >
            New search
          </Link>
        </nav>
      </div>

      <section className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
        {currentState.status === "loading" && (
          <LoadingState playerName={playerName} />
        )}

        {currentState.status === "error" && currentState.error && (
          <ErrorState
            error={currentState.error}
            onRetry={retry}
            onSelectPlayer={selectPlayer}
          />
        )}

        {currentState.status === "success" && currentState.result && (
          <>
            <header className="grid gap-6 border-b border-white/10 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                  Scouting report
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                  {currentState.result.target.Name}
                </h1>
                <p className="mt-3 text-sm text-slate-400">
                  {currentState.result.target.Display_Name}
                </p>
              </div>

              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                <div className="min-w-24 bg-[#0d1914] px-4 py-3">
                  <dt className="text-xs text-slate-500">Position</dt>
                  <dd className="mt-1 font-bold text-white">
                    {formatValue(currentState.result.target.Position)}
                  </dd>
                </div>
                <div className="min-w-20 bg-[#0d1914] px-4 py-3">
                  <dt className="text-xs text-slate-500">Age</dt>
                  <dd className="mt-1 font-bold text-white">
                    {formatValue(currentState.result.target.Age)}
                  </dd>
                </div>
                <div className="min-w-32 bg-[#0d1914] px-4 py-3">
                  <dt className="text-xs text-slate-500">Market value</dt>
                  <dd className="mt-1 font-bold text-white">
                    {formatCurrency(
                      currentState.result.target.MarketValue
                    )}
                  </dd>
                </div>
              </dl>
            </header>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Model recommendations
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Each engine evaluates a different similarity hypothesis.
                </p>
              </div>
              <div className="flex gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 px-3 py-1.5">
                  {currentState.result.model.featureCount} features
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1.5">
                  KNN K={currentState.result.model.bestKnnK}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1.5">
                  K-Means K={currentState.result.model.bestKMeansK}
                </span>
              </div>
            </div>

            <div
              aria-live="polite"
              className="mt-6 grid items-start gap-5 lg:grid-cols-2"
            >
              {models.map(([modelName, players], index) => (
                <ModelCard
                  key={modelName}
                  modelName={modelName}
                  players={players}
                  style={modelStyles[index % modelStyles.length]}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default Result;
