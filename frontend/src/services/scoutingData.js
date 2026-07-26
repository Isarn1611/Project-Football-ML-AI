import { supabase } from "../lib/supabase";

const SHORTLIST_TABLE = "player_shortlist";
const SEARCH_HISTORY_TABLE = "player_search_history";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured for this frontend.");
  }

  return supabase;
}

async function getAuthenticatedUserId(client) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user?.id) {
    throw new Error("Sign in is required to save scouting data.");
  }

  return user.id;
}

function cleanText(value) {
  const cleaned = String(value || "").trim();
  return cleaned || null;
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dedupeSearchHistoryRows(rows = []) {
  const seenQueries = new Set();

  return rows.filter((row) => {
    const queryKey = cleanText(row.query)?.toLocaleLowerCase();

    if (!queryKey || seenQueries.has(queryKey)) {
      return false;
    }

    seenQueries.add(queryKey);
    return true;
  });
}

function pick(player, keys) {
  for (const key of keys) {
    if (player?.[key] !== undefined && player?.[key] !== null && player[key] !== "") {
      return player[key];
    }
  }

  return null;
}

export function getPlayerName(player) {
  return cleanText(
    pick(player, ["Name", "name", "player_name", "playerName"])
  );
}

export function getPlayerKey(player) {
  const uid = cleanText(pick(player, ["UID", "uid", "id", "player_uid"]));
  const name = getPlayerName(player);

  return String(uid || name || "")
    .trim()
    .toLocaleLowerCase();
}

export function buildShortlistPayload(userId, player, source = "manual") {
  const playerName = getPlayerName(player);
  const playerKey = getPlayerKey(player);

  if (!userId) {
    throw new Error("Sign in is required to save players.");
  }

  if (!playerName || !playerKey) {
    throw new Error("Could not identify this player.");
  }

  return {
    user_id: userId,
    player_key: playerKey,
    player_uid: cleanText(pick(player, ["UID", "uid", "id", "player_uid"])),
    player_name: playerName,
    club: cleanText(pick(player, ["Club", "club"])),
    position: cleanText(
      pick(player, ["FullPosition", "Position", "position"])
    ),
    age: cleanNumber(pick(player, ["Age", "age"])),
    nationality: cleanText(pick(player, ["Nationality", "nationality"])),
    market_value: cleanNumber(
      pick(player, ["MarketValue", "marketValue", "market_value"])
    ),
    score: cleanNumber(pick(player, ["Score", "score"])),
    source,
    snapshot: player || {},
  };
}

export async function loadShortlist(userId, limit = 50) {
  const client = requireSupabase();

  const { data, error } = await client
    .from(SHORTLIST_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function upsertShortlistPlayer(userId, player, source) {
  const client = requireSupabase();
  const payload = buildShortlistPayload(userId, player, source);

  const { data, error } = await client
    .from(SHORTLIST_TABLE)
    .upsert(payload, { onConflict: "user_id,player_key" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeShortlistItem(userId, itemId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from(SHORTLIST_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("id", itemId)
    .select("id");

  if (error) throw error;
  if (!data?.length) {
    throw new Error(
      "Shortlist delete was not applied. Run the latest shortlist delete RLS migration in Supabase.",
    );
  }
}

export async function removeShortlistPlayer(userId, playerKey) {
  const client = requireSupabase();
  const { data, error } = await client
    .from(SHORTLIST_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("player_key", playerKey)
    .select("id");

  if (error) throw error;
  if (!data?.length) {
    throw new Error(
      "Shortlist delete was not applied. Run the latest shortlist delete RLS migration in Supabase.",
    );
  }
}

export async function loadSearchHistory(userId, limit = 25) {
  const client = requireSupabase();

  const { data, error } = await client
    .from(SEARCH_HISTORY_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return dedupeSearchHistoryRows(data || []);
}

export async function recordSearch(userId, query, metadata = {}) {
  const client = requireSupabase();
  const authenticatedUserId = await getAuthenticatedUserId(client);
  const cleanedQuery = cleanText(query);

  if (!cleanedQuery) {
    return null;
  }

  const now = new Date().toISOString();
  const payload = {
    user_id: authenticatedUserId,
    query: cleanedQuery,
    status: metadata.status || "searched",
    result_count: metadata.resultCount ?? null,
    error_message: metadata.errorMessage || null,
    metadata,
    created_at: now,
  };

  const { error: deleteExistingError } = await client
    .from(SEARCH_HISTORY_TABLE)
    .delete()
    .eq("user_id", authenticatedUserId)
    .eq("query", cleanedQuery);

  if (deleteExistingError) throw deleteExistingError;

  const { data, error } = await client
    .from(SEARCH_HISTORY_TABLE)
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeSearchHistoryItem(userId, itemId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from(SEARCH_HISTORY_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("id", itemId)
    .select("id");

  if (error) throw error;
  if (!data?.length) {
    throw new Error(
      "Search history delete was not applied. Run the latest search history RLS migration in Supabase.",
    );
  }
}

export async function clearSearchHistory(userId) {
  const client = requireSupabase();
  const { error } = await client
    .from(SEARCH_HISTORY_TABLE)
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}
