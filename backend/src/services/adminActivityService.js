const { getSupabaseAdminClient } = require("../config/supabase");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DATABASE_BATCH_SIZE = 1000;

function createActivityError(message, code, details) {
  const error = new Error(message);
  error.code = code;
  error.status = 503;
  error.details = details;
  return error;
}

function isMissingSearchAnalyticsSchema(error) {
  const code = error?.details?.errorCode || error?.code;
  const message = String(error?.details?.message || error?.message || "");

  return (
    code === "PGRST204" ||
    code === "42703" ||
    (/search_count|last_searched_at/i.test(message) &&
      /column|schema cache|does not exist|could not find/i.test(message))
  );
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function normalizeActivityListOptions(input = {}) {
  return {
    page: clampInteger(input.page, 1, Number.MAX_SAFE_INTEGER, 1),
    pageSize: clampInteger(
      input.pageSize || input.limit,
      1,
      MAX_PAGE_SIZE,
      DEFAULT_PAGE_SIZE
    ),
    query: String(input.q || input.query || "").trim().slice(0, 100),
  };
}

function normalizePlayerName(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function latestTimestamp(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function aggregateShortlistRows(rows = []) {
  const players = new Map();

  for (const row of rows) {
    const key = row.player_uid || normalizePlayerName(row.player_name);
    if (!key) continue;

    const timestamp = row.updated_at || row.created_at || null;
    const current = players.get(key);
    const source = String(row.source || "manual");

    if (!current) {
      players.set(key, {
        key,
        playerUid: row.player_uid || null,
        playerName: row.player_name,
        club: row.club || null,
        position: row.position || null,
        savedCount: 1,
        sourceCounts: { [source]: 1 },
        latestAt: timestamp,
      });
      continue;
    }

    current.savedCount += 1;
    current.sourceCounts[source] = (current.sourceCounts[source] || 0) + 1;
    if (timestamp === latestTimestamp(timestamp, current.latestAt)) {
      current.playerName = row.player_name || current.playerName;
      current.club = row.club || current.club;
      current.position = row.position || current.position;
    }
    current.latestAt = latestTimestamp(current.latestAt, timestamp);
  }

  return [...players.values()].sort(
    (left, right) =>
      right.savedCount - left.savedCount ||
      String(right.latestAt || "").localeCompare(String(left.latestAt || ""))
  );
}

function aggregateSearchRows(rows = []) {
  const players = new Map();

  for (const row of rows) {
    const key = row.metadata?.playerUid || normalizePlayerName(row.query);
    if (!key) continue;

    const count = Math.max(1, Number.parseInt(row.search_count, 10) || 1);
    const timestamp = row.last_searched_at || row.created_at || null;
    const current = players.get(key);

    if (!current) {
      players.set(key, {
        key,
        playerUid: row.metadata?.playerUid || null,
        playerName: row.query,
        searchCount: count,
        uniqueAccounts: 1,
        latestAt: timestamp,
      });
      continue;
    }

    current.searchCount += count;
    current.uniqueAccounts += 1;
    if (timestamp === latestTimestamp(timestamp, current.latestAt)) {
      current.playerName = row.query || current.playerName;
    }
    current.latestAt = latestTimestamp(current.latestAt, timestamp);
  }

  return [...players.values()].sort(
    (left, right) =>
      right.searchCount - left.searchCount ||
      String(right.latestAt || "").localeCompare(String(left.latestAt || ""))
  );
}

async function loadAllRows(config) {
  const client = getSupabaseAdminClient();
  const rows = [];

  for (let from = 0; ; from += DATABASE_BATCH_SIZE) {
    const { data, error } = await client
      .from(config.table)
      .select(config.select)
      .order("id", { ascending: true })
      .range(from, from + DATABASE_BATCH_SIZE - 1);

    if (error) {
      throw createActivityError(
        config.errorMessage,
        config.errorCode,
        { errorCode: error.code, message: error.message }
      );
    }

    rows.push(...(data || []));
    if (!data || data.length < DATABASE_BATCH_SIZE) break;
  }

  return rows;
}

async function listAdminPlayerActivity(config, input = {}) {
  const options = normalizeActivityListOptions(input);
  const rows = await loadAllRows(config);
  const normalizedQuery = normalizePlayerName(options.query);
  const aggregated = config
    .aggregate(rows)
    .filter(
      (item) =>
        !normalizedQuery ||
        normalizePlayerName(item.playerName).includes(normalizedQuery) ||
        normalizePlayerName(item.club).includes(normalizedQuery)
    );
  const start = (options.page - 1) * options.pageSize;

  return {
    items: aggregated.slice(start, start + options.pageSize),
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total: aggregated.length,
      totalPages: Math.max(1, Math.ceil(aggregated.length / options.pageSize)),
    },
    query: options.query,
  };
}

function listAdminShortlistEntries(input = {}) {
  return listAdminPlayerActivity(
    {
      aggregate: aggregateShortlistRows,
      errorCode: "ADMIN_SHORTLIST_UNAVAILABLE",
      errorMessage: "Could not load shortlist popularity",
      select:
        "player_uid,player_name,club,position,source,created_at,updated_at",
      table: "player_shortlist",
    },
    input
  );
}

async function listAdminSearchHistory(input = {}) {
  const baseConfig = {
    aggregate: aggregateSearchRows,
    errorCode: "ADMIN_SEARCH_HISTORY_UNAVAILABLE",
    errorMessage: "Could not load search popularity",
    table: "player_search_history",
  };

  try {
    return await listAdminPlayerActivity(
      {
        ...baseConfig,
        select: "query,search_count,metadata,created_at,last_searched_at",
      },
      input
    );
  } catch (error) {
    if (!isMissingSearchAnalyticsSchema(error)) throw error;

    const result = await listAdminPlayerActivity(
      { ...baseConfig, select: "query,metadata,created_at" },
      input
    );
    return { ...result, countMode: "legacy_unique_records" };
  }
}

module.exports = {
  aggregateSearchRows,
  aggregateShortlistRows,
  listAdminSearchHistory,
  listAdminShortlistEntries,
  normalizeActivityListOptions,
};
