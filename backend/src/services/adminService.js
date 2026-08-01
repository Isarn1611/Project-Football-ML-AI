const { getSupabaseAdminClient } = require("../config/supabase");

const PLAYER_TABLE = process.env.SUPABASE_PLAYERS_TABLE || "fm_players";
const ADMIN_USER_BATCH_SIZE = 1000;
const DEFAULT_USER_PAGE_SIZE = 20;
const MAX_USER_PAGE_SIZE = 100;
const VALID_APP_ROLES = new Set(["user", "admin"]);

function createAdminError(message, code, status = 503, details) {
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

function normalizeUserListOptions(input = {}) {
  return {
    page: clampInteger(input.page, 1, Number.MAX_SAFE_INTEGER, 1),
    pageSize: clampInteger(
      input.pageSize || input.limit,
      1,
      MAX_USER_PAGE_SIZE,
      DEFAULT_USER_PAGE_SIZE
    ),
    query: String(input.q || input.query || "").trim().slice(0, 100),
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function formatAdminUser(user, role = "user") {
  return {
    id: user.id,
    email: user.email || null,
    displayName:
      user.user_metadata?.full_name || user.user_metadata?.name || null,
    provider:
      user.app_metadata?.provider || user.identities?.[0]?.provider || "email",
    role,
    createdAt: user.created_at || null,
    lastSignInAt: user.last_sign_in_at || null,
    emailConfirmedAt: user.email_confirmed_at || null,
    bannedUntil: user.banned_until || null,
  };
}

async function listAllAuthUsers(client) {
  const users = [];
  let page = 1;

  do {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: ADMIN_USER_BATCH_SIZE,
    });

    if (error) {
      throw createAdminError(
        "Could not load Supabase Auth users",
        "ADMIN_USERS_UNAVAILABLE",
        503,
        { message: error.message }
      );
    }

    users.push(...data.users);
    page = data.nextPage;
  } while (page);

  return users;
}

async function loadUserRoles(client, userIds) {
  const roles = new Map();

  for (let index = 0; index < userIds.length; index += 200) {
    const batch = userIds.slice(index, index + 200);
    const { data, error } = await client
      .from("user_roles")
      .select("user_id,role")
      .in("user_id", batch);

    if (error) {
      throw createAdminError(
        "Could not load application roles",
        "ADMIN_USERS_UNAVAILABLE",
        503,
        { message: error.message }
      );
    }

    for (const row of data || []) {
      roles.set(row.user_id, row.role);
    }
  }

  return roles;
}

async function listAdminUsers(input = {}) {
  const options = normalizeUserListOptions(input);
  const client = getSupabaseAdminClient();
  const authUsers = await listAllAuthUsers(client);
  const roles = await loadUserRoles(
    client,
    authUsers.map((user) => user.id)
  );
  const query = options.query.toLocaleLowerCase();
  const matchingUsers = authUsers
    .map((user) => formatAdminUser(user, roles.get(user.id) || "user"))
    .filter((user) => {
      if (!query) return true;
      return [user.email, user.displayName]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(query));
    })
    .sort((left, right) =>
      String(right.createdAt || "").localeCompare(String(left.createdAt || ""))
    );
  const start = (options.page - 1) * options.pageSize;

  return {
    users: matchingUsers.slice(start, start + options.pageSize),
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total: matchingUsers.length,
      totalPages: Math.max(1, Math.ceil(matchingUsers.length / options.pageSize)),
    },
    query: options.query,
  };
}

async function updateAdminUserRole(actorUserId, targetUserId, nextRole) {
  const role = String(nextRole || "").trim().toLowerCase();

  if (!isUuid(actorUserId) || !isUuid(targetUserId)) {
    throw createAdminError(
      "A valid user id is required",
      "INVALID_USER_ID",
      400
    );
  }

  if (!VALID_APP_ROLES.has(role)) {
    throw createAdminError(
      "Role must be user or admin",
      "INVALID_USER_ROLE",
      400
    );
  }

  if (actorUserId === targetUserId && role !== "admin") {
    throw createAdminError(
      "Administrators cannot remove their own access",
      "CANNOT_CHANGE_OWN_ROLE",
      400
    );
  }

  const client = getSupabaseAdminClient();
  const { data: authData, error: authError } =
    await client.auth.admin.getUserById(targetUserId);

  if (authError || !authData?.user) {
    throw createAdminError(
      "User was not found",
      "ADMIN_USER_NOT_FOUND",
      404
    );
  }

  const { data, error } = await client.rpc("admin_set_user_role", {
    p_actor_user_id: actorUserId,
    p_target_user_id: targetUserId,
    p_role: role,
  });

  if (error) {
    const knownErrors = {
      ACTOR_NOT_ADMIN: ["Administrator access is required", "FORBIDDEN", 403],
      CANNOT_CHANGE_OWN_ROLE: [
        "Administrators cannot remove their own access",
        "CANNOT_CHANGE_OWN_ROLE",
        400,
      ],
      USER_ROLE_NOT_FOUND: ["User role was not found", "ADMIN_USER_NOT_FOUND", 404],
    };
    const knownError = knownErrors[error.message];

    if (knownError) {
      throw createAdminError(...knownError);
    }

    throw createAdminError(
      "Could not update the user role",
      "ADMIN_ROLE_UPDATE_FAILED",
      503,
      { message: error.message }
    );
  }

  return formatAdminUser(authData.user, data?.role || role);
}

async function countTableRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    const dashboardError = new Error(
      `Could not count rows in ${table}`
    );
    dashboardError.status = 503;
    dashboardError.code = "ADMIN_DASHBOARD_UNAVAILABLE";
    dashboardError.details = {
      table,
      message: error.message,
    };
    throw dashboardError;
  }

  return count || 0;
}

async function getAdminDashboard() {
  const client = getSupabaseAdminClient();
  const [users, players, shortlistItems, searchHistoryItems] =
    await Promise.all([
      countTableRows(client, "user_roles"),
      countTableRows(client, PLAYER_TABLE),
      countTableRows(client, "player_shortlist"),
      countTableRows(client, "player_search_history"),
    ]);

  return {
    counts: {
      users,
      players,
      shortlistItems,
      searchHistoryItems,
    },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  countTableRows,
  getAdminDashboard,
  listAdminUsers,
  normalizeUserListOptions,
  updateAdminUserRole,
};
