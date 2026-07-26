import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  clearAiAnalysisCache,
  clearRecommendationCache,
  getAiAnalysis,
  getRecommendations,
} from "../services/api";
import { useAuth } from "../auth/useAuth";
import AuthMenu from "../components/AuthMenu";
import {
  getPlayerKey,
  loadShortlist,
  recordSearch,
  removeShortlistPlayer,
  upsertShortlistPlayer,
} from "../services/scoutingData";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  maximumFractionDigits: 1,
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

const attributeGroupStyles = {
  Technical: {
    label: "Technical",
    accent: "text-emerald-300",
    bar: "bg-emerald-300",
    border: "border-emerald-300/15",
  },
  Mental: {
    label: "Mental",
    accent: "text-cyan-300",
    bar: "bg-cyan-300",
    border: "border-cyan-300/15",
  },
  Physical: {
    label: "Physical",
    accent: "text-amber-300",
    bar: "bg-amber-300",
    border: "border-amber-300/15",
  },
  Goalkeeping: {
    label: "Goalkeeping",
    accent: "text-violet-300",
    bar: "bg-violet-300",
    border: "border-violet-300/15",
  },
};

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

function formatCompactCurrency(value) {
  const numericValue = Number(value);

  return value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(numericValue)
    ? "—"
    : compactCurrencyFormatter.format(numericValue);
}

function normalizeScore(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 0;
  return Math.max(0, Math.min(100, numericScore));
}

function normalizeAttribute(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(20, numericValue));
}

function getVisibleAttributeGroups(attributes, position) {
  const isGoalkeeper = String(position || "")
    .toUpperCase()
    .startsWith("GK");

  return Object.entries(attributes || {}).filter(
    ([groupName, values]) =>
      Object.keys(values || {}).length > 0 &&
      (groupName !== "Goalkeeping" || isGoalkeeper)
  );
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

function readAiApiError(error) {
  const payload = error.response?.data;
  return {
    code: payload?.code || "AI_REQUEST_FAILED",
    message:
      payload?.message ||
      "Could not generate the AI analysis. Check the Gemini configuration and try again.",
  };
}

function readShortlistError(error) {
  const message = error?.message || "Could not update shortlist.";
  if (
    message.includes("player_search_history") ||
    message.includes("row-level security policy")
  ) {
    return "Search history policy needs to be updated in Supabase. Run the latest search history RLS SQL migration.";
  }

  if (
    message.includes("player_shortlist") ||
    message.includes("Could not find the table")
  ) {
    return "Run the Supabase shortlist/history SQL migration before using shortlist.";
  }

  return message;
}

function countModelResults(results) {
  return Object.values(results || {}).reduce(
    (total, players) => total + (Array.isArray(players) ? players.length : 0),
    0
  );
}

function ShortlistButton({ disabled, isSaved, onClick, size = "default" }) {
  const sizeClass =
    size === "small"
      ? "rounded-lg px-3 py-2 text-xs"
      : "rounded-xl px-5 py-3 text-sm";

  return (
    <button
      className={`${sizeClass} border font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        isSaved
          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200 hover:bg-emerald-300/15"
          : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-emerald-300/40 hover:text-emerald-200"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {isSaved ? "Saved" : "Save"}
    </button>
  );
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

function AttributeGroupCard({ groupName, attributes }) {
  const style =
    attributeGroupStyles[groupName] || attributeGroupStyles.Technical;

  return (
    <article
      className={`rounded-2xl border ${style.border} bg-white/[0.04] p-5`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3
          className={`text-xs font-bold uppercase tracking-[0.22em] ${style.accent}`}
        >
          {style.label}
        </h3>
        <span className="text-xs text-slate-600">1–20</span>
      </div>
      <dl className="space-y-3">
        {Object.entries(attributes).map(([attributeName, value]) => {
          const normalizedValue = normalizeAttribute(value);

          return (
            <div key={attributeName}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <dt className="truncate text-xs text-slate-400">
                  {attributeName}
                </dt>
                <dd
                  className={`text-sm font-black tabular-nums ${style.accent}`}
                >
                  {formatValue(value)}
                </dd>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/8">
                <div
                  aria-label={`${attributeName} ${value} out of 20`}
                  aria-valuemax="20"
                  aria-valuemin="0"
                  aria-valuenow={normalizedValue}
                  className={`h-full rounded-full ${style.bar}`}
                  role="progressbar"
                  style={{ width: `${(normalizedValue / 20) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </dl>
    </article>
  );
}

function TargetAttributes({ target }) {
  const groups = getVisibleAttributeGroups(
    target.Attributes,
    target.FullPosition || target.Position
  );

  if (groups.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Player profile
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">
            Attribute overview
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-white/10 px-3 py-1.5">
            {formatValue(target.Nationality)}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1.5">
            {formatValue(target.Height)} cm
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1.5">
            {formatValue(target.Weight)} kg
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1.5">
            Left foot {formatValue(target.LeftFoot)}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1.5">
            Right foot {formatValue(target.RightFoot)}
          </span>
        </div>
      </div>

      <div
        className={`mt-5 grid items-start gap-4 ${
          groups.length === 4
            ? "md:grid-cols-2 xl:grid-cols-4"
            : "md:grid-cols-2 xl:grid-cols-3"
        }`}
      >
        {groups.map(([groupName, attributes]) => (
          <AttributeGroupCard
            attributes={attributes}
            groupName={groupName}
            key={groupName}
          />
        ))}
      </div>
    </section>
  );
}

function CandidateAttributeDetails({ player }) {
  const groups = getVisibleAttributeGroups(
    player.Attributes,
    player.Position
  );

  if (groups.length === 0) return null;

  return (
    <details className="group col-span-4 mt-1 rounded-xl border border-white/[0.07] bg-black/15">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs text-slate-400 transition hover:text-emerald-200 [&::-webkit-details-marker]:hidden">
        <span>View player attributes</span>
        <span className="text-right text-slate-600">
          {formatValue(player.Club)} · {formatValue(player.Position)} · PA{" "}
          {formatValue(player.PA)}
        </span>
      </summary>
      <div className="grid gap-4 border-t border-white/[0.07] p-3 sm:grid-cols-3">
        {groups.map(([groupName, attributes]) => {
          const style =
            attributeGroupStyles[groupName] ||
            attributeGroupStyles.Technical;

          return (
            <div key={groupName}>
              <p
                className={`mb-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] ${style.accent}`}
              >
                {style.label}
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {Object.entries(attributes).map(
                  ([attributeName, value]) => (
                    <div
                      className="flex min-w-0 justify-between gap-2 text-[0.68rem]"
                      key={attributeName}
                    >
                      <dt className="truncate text-slate-500">
                        {attributeName}
                      </dt>
                      <dd className="font-bold tabular-nums text-slate-300">
                        {formatValue(value)}
                      </dd>
                    </div>
                  )
                )}
              </dl>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function InsightList({ accent, items, title }) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-black/15 p-5">
      <h4
        className={`text-xs font-bold uppercase tracking-[0.2em] ${accent}`}
      >
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No evidence available.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
          {items.map((item, index) => (
            <li className="flex gap-2" key={`${title}-${index}`}>
              <span aria-hidden="true" className={accent}>
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function BestChoice({ label, name }) {
  return (
    <div className="bg-[#0d1914] px-4 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-bold text-white">{formatValue(name)}</dd>
    </div>
  );
}

function AiAnalysisResult({
  result,
  shortlistActionKey,
  shortlistKeys,
  onToggleShortlist,
}) {
  const { analysis } = result;
  const totalTokens = result.usage?.totalTokens;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1.5 text-cyan-200">
          {result.provider} · {result.model}
        </span>
        <span className="rounded-full border border-white/10 px-3 py-1.5">
          ML evidence only
        </span>
        {totalTokens !== null && totalTokens !== undefined && (
          <span className="rounded-full border border-white/10 px-3 py-1.5">
            {totalTokens.toLocaleString()} tokens
          </span>
        )}
      </div>

      <h3 className="mt-5 text-2xl font-black tracking-tight text-white">
        {analysis.title}
      </h3>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
        {analysis.executiveSummary}
      </p>

      <div className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
          Target play style
        </p>
        <p className="mt-2 text-sm leading-7 text-slate-200">
          {analysis.targetProfile.playStyle}
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <InsightList
          accent="text-emerald-300"
          items={analysis.targetProfile.strengths}
          title="Strengths"
        />
        <InsightList
          accent="text-amber-300"
          items={analysis.targetProfile.weaknesses}
          title="Weaknesses"
        />
        <InsightList
          accent="text-rose-300"
          items={analysis.targetProfile.risks}
          title="Risks"
        />
      </div>

      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          AI shortlist
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {analysis.recommendations.map((recommendation, index) => {
            const recommendationPlayer = {
              Name: recommendation.playerName,
              sourceRecommendation: recommendation,
            };
            const playerKey = getPlayerKey(recommendationPlayer);
            const isSaved = shortlistKeys.has(playerKey);

            return (
            <article
              className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5"
              key={`${recommendation.playerName}-${index}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-xs font-black text-cyan-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="truncate font-bold text-white">
                      {recommendation.playerName}
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {recommendation.fitSummary}
                    </p>
                  </div>
                </div>
                <ShortlistButton
                  disabled={shortlistActionKey === playerKey}
                  isSaved={isSaved}
                  onClick={() =>
                    onToggleShortlist(recommendationPlayer, "AI shortlist")
                  }
                  size="small"
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
                    Why it fits
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-300">
                    {recommendation.reasons.map((reason, reasonIndex) => (
                      <li key={`${recommendation.playerName}-reason-${reasonIndex}`}>
                        • {reason}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">
                    Watch points
                  </p>
                  {recommendation.concerns.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      No major concern identified.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-400">
                      {recommendation.concerns.map(
                        (concern, concernIndex) => (
                          <li
                            key={`${recommendation.playerName}-concern-${concernIndex}`}
                          >
                            • {concern}
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </article>
            );
          })}
        </div>
      </div>

      <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        <BestChoice label="Best overall" name={analysis.bestChoices.overall} />
        <BestChoice
          label="Closest style"
          name={analysis.bestChoices.styleMatch}
        />
        <BestChoice label="Best value" name={analysis.bestChoices.value} />
        <BestChoice
          label="Best potential"
          name={analysis.bestChoices.potential}
        />
      </dl>

      <p className="mt-5 border-t border-white/[0.08] pt-4 text-xs leading-5 text-slate-500">
        {analysis.confidenceNote}
      </p>
    </div>
  );
}

function AiAnalysisPanel({
  aiState,
  shortlistActionKey,
  shortlistKeys,
  onGenerate,
  onRetry,
  onToggleShortlist,
}) {
  return (
    <section className="mt-10 overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.08] via-white/[0.035] to-emerald-300/[0.04] p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">
            AI scouting analysis
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">
            Turn ML evidence into a scouting brief
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Gemini compares the target with the ML shortlist, then explains
            strengths, risks, value and potential. It only receives the
            dataset evidence shown in this report.
          </p>
        </div>

        {aiState.status === "idle" && (
          <button
            className="shrink-0 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
            onClick={onGenerate}
            type="button"
          >
            Generate AI analysis
          </button>
        )}

        {aiState.status === "loading" && (
          <button
            aria-busy="true"
            className="inline-flex shrink-0 cursor-wait items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-200"
            disabled
            type="button"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-100/30 border-t-cyan-100" />
            Analyzing…
          </button>
        )}
      </div>

      {aiState.status === "loading" && (
        <div aria-live="polite" className="mt-6 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              className="h-24 animate-pulse rounded-2xl bg-white/[0.05]"
              key={item}
            />
          ))}
        </div>
      )}

      {aiState.status === "error" && (
        <div
          aria-live="assertive"
          className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5"
        >
          <p className="text-sm font-bold text-rose-200">
            AI analysis unavailable
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {aiState.error.message}
          </p>
          <button
            className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/30 hover:text-cyan-200"
            onClick={onRetry}
            type="button"
          >
            Try AI analysis again
          </button>
        </div>
      )}

      {aiState.status === "success" && aiState.result && (
        <AiAnalysisResult
          result={aiState.result}
          shortlistActionKey={shortlistActionKey}
          shortlistKeys={shortlistKeys}
          onToggleShortlist={onToggleShortlist}
        />
      )}
    </section>
  );
}

function ModelCard({
  modelName,
  players,
  shortlistActionKey,
  shortlistKeys,
  style,
  onToggleShortlist,
}) {
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
            const playerKey = getPlayerKey(player);
            const isSaved = shortlistKeys.has(playerKey);

            return (
              <li
                className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 px-5 py-4"
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
                <div className="min-w-20 text-right text-[0.68rem] text-slate-500 sm:min-w-24 sm:text-xs">
                  <span className="block">
                    Age {formatValue(player.Age)} · CA{" "}
                    {formatValue(player.CA)}
                  </span>
                  <span className="mt-1 block font-semibold text-emerald-200">
                    Value {formatCompactCurrency(player.MarketValue)}
                  </span>
                </div>
                {!isOutlier ? (
                  <ShortlistButton
                    disabled={shortlistActionKey === playerKey}
                    isSaved={isSaved}
                    onClick={() =>
                      onToggleShortlist(player, `${modelName} candidate`)
                    }
                    size="small"
                  />
                ) : (
                  <span />
                )}
                {!isOutlier && (
                  <CandidateAttributeDetails player={player} />
                )}
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
  const { user } = useAuth();
  const recordedHistoryKeys = useRef(new Set());
  const playerName = searchParams.get("player")?.trim() || "";
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${playerName}:${reloadToken}`;
  const [requestState, setRequestState] = useState({
    key: "",
    status: "idle",
    result: null,
    error: null,
  });
  const aiRequestKey = playerName.toLocaleLowerCase();
  const [aiState, setAiState] = useState({
    key: "",
    status: "idle",
    result: null,
    error: null,
  });
  const [shortlistState, setShortlistState] = useState({
    actionKey: "",
    error: "",
    items: [],
    loading: true,
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

  useEffect(() => {
    let isActive = true;

    if (!user?.id) {
      setShortlistState({
        actionKey: "",
        error: "",
        items: [],
        loading: false,
      });
      return () => {
        isActive = false;
      };
    }

    setShortlistState((state) => ({
      ...state,
      error: "",
      loading: true,
    }));

    loadShortlist(user.id)
      .then((items) => {
        if (!isActive) return;
        setShortlistState({
          actionKey: "",
          error: "",
          items,
          loading: false,
        });
      })
      .catch((error) => {
        if (!isActive) return;
        setShortlistState({
          actionKey: "",
          error: readShortlistError(error),
          items: [],
          loading: false,
        });
      });

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  const currentState = useMemo(() => {
    if (!playerName) {
      return {
        status: "error",
        result: null,
        error: {
          code: "MISSING_PLAYER",
          message: "No player was selected for analysis.",
          matches: [],
        },
      };
    }

    return requestState.key === requestKey
      ? requestState
      : {
          status: "loading",
          result: null,
          error: null,
        };
  }, [playerName, requestKey, requestState]);

  const models = useMemo(
    () => Object.entries(currentState.result?.results || {}),
    [currentState.result]
  );
  const currentAiState =
    aiState.key === aiRequestKey
      ? aiState
      : {
          key: aiRequestKey,
          status: "idle",
          result: null,
          error: null,
        };
  const shortlistKeys = useMemo(
    () =>
      new Set(
        shortlistState.items
          .map((item) => item.player_key)
          .filter(Boolean)
      ),
    [shortlistState.items]
  );
  const targetPlayer = currentState.result?.target;
  const targetPlayerKey = targetPlayer ? getPlayerKey(targetPlayer) : "";
  const isTargetSaved = shortlistKeys.has(targetPlayerKey);

  useEffect(() => {
    if (
      !user?.id ||
      currentState.status !== "success" ||
      !currentState.result
    ) {
      return;
    }

    const targetName = currentState.result.target?.Name || playerName;
    const historyKey = `${user.id}:${targetName}:${currentState.key || requestKey}`;

    if (recordedHistoryKeys.current.has(historyKey)) {
      return;
    }

    recordedHistoryKeys.current.add(historyKey);
    recordSearch(user.id, targetName, {
      status: "success",
      requestedQuery: playerName,
      resultCount: countModelResults(currentState.result.results),
      submittedFrom: "result_page",
    }).catch((error) => {
      setShortlistState((state) => ({
        ...state,
        error: readShortlistError(error),
      }));
    });
  }, [currentState, playerName, requestKey, user?.id]);

  function retry() {
    clearRecommendationCache(playerName);
    setReloadToken((value) => value + 1);
  }

  function selectPlayer(name) {
    setSearchParams({ player: name });
  }

  async function toggleShortlist(player, source) {
    if (!user?.id) {
      setShortlistState((state) => ({
        ...state,
        error: "Sign in is required to save players.",
      }));
      return;
    }

    const playerKey = getPlayerKey(player);
    if (!playerKey) {
      setShortlistState((state) => ({
        ...state,
        error: "Could not identify this player.",
      }));
      return;
    }

    const isSaved = shortlistKeys.has(playerKey);

    setShortlistState((state) => ({
      ...state,
      actionKey: playerKey,
      error: "",
    }));

    try {
      if (isSaved) {
        await removeShortlistPlayer(user.id, playerKey);
        setShortlistState((state) => ({
          ...state,
          actionKey: "",
          items: state.items.filter((item) => item.player_key !== playerKey),
        }));
        return;
      }

      const item = await upsertShortlistPlayer(user.id, player, source);
      setShortlistState((state) => ({
        ...state,
        actionKey: "",
        items: [
          item,
          ...state.items.filter(
            (existingItem) => existingItem.player_key !== item.player_key
          ),
        ],
      }));
    } catch (error) {
      setShortlistState((state) => ({
        ...state,
        actionKey: "",
        error: readShortlistError(error),
      }));
    }
  }

  async function generateAiAnalysis() {
    const activeKey = aiRequestKey;

    setAiState({
      key: activeKey,
      status: "loading",
      result: null,
      error: null,
    });

    try {
      const result = await getAiAnalysis(playerName);
      setAiState((state) =>
        state.key === activeKey
          ? {
              key: activeKey,
              status: "success",
              result,
              error: null,
            }
          : state
      );
    } catch (error) {
      setAiState((state) =>
        state.key === activeKey
          ? {
              key: activeKey,
              status: "error",
              result: null,
              error: readAiApiError(error),
            }
          : state
      );
    }
  }

  function retryAiAnalysis() {
    clearAiAnalysisCache(playerName);
    generateAiAnalysis();
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
          <div className="flex items-center gap-3">
            <Link
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-emerald-300/40 hover:text-emerald-200"
              to="/"
            >
              New search
            </Link>
            <AuthMenu />
          </div>
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

              <div className="grid gap-3">
                <div className="flex justify-start lg:justify-end">
                  <ShortlistButton
                    disabled={
                      shortlistState.loading ||
                      shortlistState.actionKey === targetPlayerKey
                    }
                    isSaved={isTargetSaved}
                    onClick={() =>
                      toggleShortlist(
                        currentState.result.target,
                        "Target player"
                      )
                    }
                  />
                </div>

                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-5">
                <div className="min-w-24 bg-[#0d1914] px-4 py-3">
                  <dt className="text-xs text-slate-500">Position</dt>
                  <dd className="mt-1 font-bold text-white">
                    {formatValue(
                      currentState.result.target.FullPosition ||
                        currentState.result.target.Position
                    )}
                  </dd>
                </div>
                <div className="min-w-20 bg-[#0d1914] px-4 py-3">
                  <dt className="text-xs text-slate-500">Age</dt>
                  <dd className="mt-1 font-bold text-white">
                    {formatValue(currentState.result.target.Age)}
                  </dd>
                </div>
                <div className="min-w-20 bg-[#0d1914] px-4 py-3">
                  <dt className="text-xs text-slate-500">CA</dt>
                  <dd className="mt-1 font-bold text-emerald-200">
                    {formatValue(
                      currentState.result.target.CurrentAbility
                    )}
                  </dd>
                </div>
                <div className="min-w-20 bg-[#0d1914] px-4 py-3">
                  <dt className="text-xs text-slate-500">PA</dt>
                  <dd className="mt-1 font-bold text-cyan-200">
                    {formatValue(
                      currentState.result.target.PotentialAbility
                    )}
                  </dd>
                </div>
                <div className="col-span-2 min-w-32 bg-[#0d1914] px-4 py-3 sm:col-span-1">
                  <dt className="text-xs text-slate-500">Market value</dt>
                  <dd className="mt-1 font-bold text-white">
                    {formatCurrency(
                      currentState.result.target.MarketValue
                    )}
                  </dd>
                </div>
                </dl>
              </div>
            </header>

            {shortlistState.error && (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100">
                {shortlistState.error}
              </div>
            )}

            <TargetAttributes target={currentState.result.target} />

            <AiAnalysisPanel
              aiState={currentAiState}
              shortlistActionKey={shortlistState.actionKey}
              shortlistKeys={shortlistKeys}
              onGenerate={generateAiAnalysis}
              onRetry={retryAiAnalysis}
              onToggleShortlist={toggleShortlist}
            />

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-8">
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
                  shortlistActionKey={shortlistState.actionKey}
                  shortlistKeys={shortlistKeys}
                  style={modelStyles[index % modelStyles.length]}
                  onToggleShortlist={toggleShortlist}
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
