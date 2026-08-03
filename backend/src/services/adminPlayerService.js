const { getSupabaseAdminClient } = require("../config/supabase");

const PLAYER_TABLE = process.env.SUPABASE_PLAYERS_TABLE || "fm_players";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function createPlayerAdminError(message, code, status = 503, details) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function normalizePlayerListOptions(input = {}) {
  return {
    page: clampInteger(input.page, 1, Number.MAX_SAFE_INTEGER, 1),
    pageSize: clampInteger(
      input.pageSize || input.limit,
      1,
      MAX_PAGE_SIZE,
      DEFAULT_PAGE_SIZE
    ),
    query: String(input.q || input.query || "")
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .slice(0, 100),
  };
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatAdminPlayer(player = {}) {
  return {
    uid: String(player.UID ?? player.uid ?? ""),
    name: player.Name ?? player.name ?? "",
    club: player.Club ?? player.club ?? "",
    age: toNumber(player.Age ?? player.age),
    nationality: player.Nationality ?? player.nationality ?? "",
    position: player.Position ?? player.position ?? "",
    currentAbility: toNumber(player.ca ?? player.CA ?? player.currentAbility),
    potentialAbility: toNumber(player.pa ?? player.PA ?? player.potentialAbility),
    marketValue: toNumber(player.Values ?? player.marketValue),
    salary: toNumber(player.Salary ?? player.salary),
  };
}

function cleanText(value, field, options = {}) {
  const cleaned = String(value ?? "").trim();
  const maxLength = options.maxLength || 120;

  if (options.required && !cleaned) {
    throw createPlayerAdminError(
      `${field} is required`,
      "INVALID_PLAYER_DATA",
      400,
      { field }
    );
  }

  if (cleaned.length > maxLength) {
    throw createPlayerAdminError(
      `${field} is too long`,
      "INVALID_PLAYER_DATA",
      400,
      { field, maxLength }
    );
  }

  return cleaned;
}

function cleanNumber(value, field, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw createPlayerAdminError(
      `${field} must be between ${min} and ${max}`,
      "INVALID_PLAYER_DATA",
      400,
      { field, min, max }
    );
  }

  return number;
}

function normalizeAdminPlayerInput(input = {}) {
  return {
    Club: cleanText(input.club, "club"),
    Age: cleanNumber(input.age, "age", 15, 60),
    Nationality: cleanText(input.nationality, "nationality", {
      required: true,
    }),
    Position: cleanText(input.position, "position", { required: true }),
    ca: cleanNumber(input.currentAbility, "currentAbility", 0, 200),
    pa: cleanNumber(input.potentialAbility, "potentialAbility", 0, 200),
    Values: cleanNumber(input.marketValue, "marketValue", -1, 10000000000),
    Salary: cleanNumber(input.salary, "salary", 0, 1000000000),
  };
}

function validatePlayerUid(uid) {
  const cleaned = String(uid || "").trim();

  if (!/^\d{1,20}$/.test(cleaned)) {
    throw createPlayerAdminError(
      "A valid player UID is required",
      "INVALID_PLAYER_UID",
      400
    );
  }

  return cleaned;
}

async function listAdminPlayers(input = {}) {
  const options = normalizePlayerListOptions(input);
  const from = (options.page - 1) * options.pageSize;
  const to = from + options.pageSize - 1;
  let query = getSupabaseAdminClient()
    .from(PLAYER_TABLE)
    .select(
      "UID,Name,Club,Age,Nationality,Position,ca,pa,Values,Salary",
      { count: "exact" }
    )
    .order("ca", { ascending: false })
    .range(from, to);

  if (options.query) {
    const filters = [
      `Name.ilike.%${options.query}%`,
      `Club.ilike.%${options.query}%`,
      `Nationality.ilike.%${options.query}%`,
    ];

    if (/^\d+$/.test(options.query)) {
      filters.push(`UID.eq.${options.query}`);
    }

    query = query.or(filters.join(","));
  }

  const { data, count, error } = await query;

  if (error) {
    throw createPlayerAdminError(
      "Could not load player records",
      "ADMIN_PLAYERS_UNAVAILABLE",
      503,
      { message: error.message }
    );
  }

  const total = count || 0;

  return {
    players: (data || []).map(formatAdminPlayer),
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
    },
    query: options.query,
  };
}

async function updateAdminPlayer(actorUserId, playerUid, input = {}) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(actorUserId || "")
  )) {
    throw createPlayerAdminError(
      "A valid administrator id is required",
      "INVALID_USER_ID",
      400
    );
  }

  const uid = validatePlayerUid(playerUid);
  const changes = normalizeAdminPlayerInput(input);
  const { data, error } = await getSupabaseAdminClient().rpc(
    "admin_update_player",
    {
      p_actor_user_id: actorUserId,
      p_player_uid: uid,
      p_changes: changes,
    }
  );

  if (error) {
    const knownErrors = {
      ACTOR_NOT_ADMIN: ["Administrator access is required", "FORBIDDEN", 403],
      INVALID_PLAYER_UID: ["Invalid player UID", "INVALID_PLAYER_UID", 400],
      INVALID_PLAYER_CHANGES: [
        "Invalid player changes",
        "INVALID_PLAYER_DATA",
        400,
      ],
      INVALID_PLAYER_TEXT: ["Invalid player text fields", "INVALID_PLAYER_DATA", 400],
      INVALID_PLAYER_AGE: ["Invalid player age", "INVALID_PLAYER_DATA", 400],
      INVALID_PLAYER_ABILITY: [
        "Invalid player ability",
        "INVALID_PLAYER_DATA",
        400,
      ],
      INVALID_PLAYER_FINANCE: [
        "Invalid player finance values",
        "INVALID_PLAYER_DATA",
        400,
      ],
      PLAYER_NOT_FOUND: ["Player was not found", "ADMIN_PLAYER_NOT_FOUND", 404],
    };
    const knownError = knownErrors[error.message];

    if (knownError) {
      throw createPlayerAdminError(...knownError);
    }

    throw createPlayerAdminError(
      "Could not update the player",
      "ADMIN_PLAYER_UPDATE_FAILED",
      503,
      { message: error.message }
    );
  }

  return formatAdminPlayer(data);
}

module.exports = {
  formatAdminPlayer,
  listAdminPlayers,
  normalizeAdminPlayerInput,
  normalizePlayerListOptions,
  updateAdminPlayer,
  validatePlayerUid,
};
