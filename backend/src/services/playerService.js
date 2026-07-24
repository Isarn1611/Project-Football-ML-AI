const { supabaseRequest } = require("../config/supabase");

const PLAYER_TABLE = process.env.SUPABASE_PLAYERS_TABLE || "fm_players";
const NAME_COLUMNS = [
  process.env.SUPABASE_PLAYER_NAME_COLUMN,
  "Name",
  "name",
  "player_name",
].filter(Boolean);

function cleanSearchTerm(name) {
  return String(name || "").trim();
}

function pick(player, keys, fallback = null) {
  for (const key of keys) {
    if (player[key] !== undefined && player[key] !== null && player[key] !== "") {
      return player[key];
    }
  }
  return fallback;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(number) ? null : number;
}

function formatPlayer(player) {
  return {
    id: pick(player, ["id", "UID", "uid"]),
    uid: pick(player, ["UID", "uid"]),
    name: pick(player, ["Name", "name", "player_name"], "Unknown Player"),
    position: pick(player, ["Position", "position"]),
    age: toNumber(pick(player, ["Age", "age"])),
    nationality: pick(player, ["Nationality", "nationality"]),
    club: pick(player, ["Club", "club"]),
    currentAbility: toNumber(pick(player, ["ca", "CA", "current_ability"])),
    potentialAbility: toNumber(pick(player, ["pa", "PA", "potential_ability"])),
    marketValue: toNumber(pick(player, ["Values", "values", "market_value"])),
    salary: toNumber(pick(player, ["Salary", "salary"])),
    attributes: {
      crossing: toNumber(pick(player, ["Crossing", "crossing"])),
      dribbling: toNumber(pick(player, ["Dribbling", "dribbling"])),
      finishing: toNumber(pick(player, ["Finishing", "finishing"])),
      passing: toNumber(pick(player, ["Passing", "passing"])),
      tackling: toNumber(pick(player, ["Tackling", "tackling"])),
      technique: toNumber(pick(player, ["Technique", "technique"])),
      vision: toNumber(pick(player, ["Vision", "vision"])),
      pace: toNumber(pick(player, ["Pace", "pace"])),
      stamina: toNumber(pick(player, ["Stamina", "stamina"])),
      strength: toNumber(pick(player, ["Strength", "strength"])),
    },
    raw: player,
  };
}

async function searchPlayersByName(name, limit = 10) {
  const searchTerm = cleanSearchTerm(name);

  if (searchTerm.length < 2) {
    const error = new Error("Player name must contain at least 2 characters");
    error.status = 400;
    throw error;
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const triedColumns = [];
  let lastError = null;

  for (const column of NAME_COLUMNS) {
    triedColumns.push(column);

    try {
      const rows = await supabaseRequest(PLAYER_TABLE, {
        select: "*",
        [column]: `ilike.*${searchTerm.replace(/\*/g, "")}*`,
        limit: safeLimit,
      });

      return {
        table: PLAYER_TABLE,
        searchedColumn: column,
        count: rows.length,
        players: rows.map(formatPlayer),
      };
    } catch (error) {
      lastError = error;
      if (error.status !== 400 && error.status !== 404) {
        throw error;
      }
    }
  }

  const error = new Error(
    `Could not search players table "${PLAYER_TABLE}". Tried name columns: ${triedColumns.join(", ")}`
  );
  error.status = lastError?.status || 500;
  error.details = lastError?.details;
  throw error;
}

module.exports = {
  searchPlayersByName,
};
