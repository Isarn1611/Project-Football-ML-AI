const { getSupabaseAdminClient } = require("../config/supabase");

const PLAYER_TABLE = process.env.SUPABASE_PLAYERS_TABLE || "fm_players";

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
};
