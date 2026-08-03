const { supabaseRequest } = require("../config/supabase");

const PLAYER_TABLE = process.env.SUPABASE_PLAYERS_TABLE || "fm_players";
const NAME_COLUMNS = [
  process.env.SUPABASE_PLAYER_NAME_COLUMN,
  "Name",
  "name",
  "player_name",
].filter(Boolean);

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const MIN_POSITION_SCORE = 15;
const POSITION_COLUMNS = [
  "GK",
  "DL",
  "DC",
  "DR",
  "WBL",
  "WBR",
  "DM",
  "ML",
  "MC",
  "MR",
  "AML",
  "AMC",
  "AMR",
  "ST",
];
const POSITION_GROUPS = {
  goalkeeper: ["GK"],
  defender: ["DL", "DC", "DR", "WBL", "WBR"],
  fullback: ["DL", "DR", "WBL", "WBR"],
  midfielder: ["DM", "ML", "MC", "MR"],
  playmaker: ["MC", "AMC"],
  winger: ["ML", "MR", "AML", "AMR"],
  attacker: ["AML", "AMC", "AMR", "ST"],
  striker: ["ST"],
};
const PRESET_FILTERS = {
  wonderkids: {
    maxAge: 21,
    minPA: 140,
    sort: "potential_desc",
  },
  bargains: {
    maxValue: 10000000,
    minCA: 120,
    sort: "value_asc",
  },
  elite: {
    minCA: 160,
    sort: "ability_desc",
  },
};
const SORT_OPTIONS = {
  ability_desc: "ca.desc",
  potential_desc: "pa.desc",
  age_asc: "Age.asc",
  value_asc: "Values.asc",
  wage_asc: "Salary.asc",
  name_asc: "Name.asc",
};

function cleanSearchTerm(name) {
  return String(name || "").trim();
}

function normalizePlayerNames(names) {
  if (!Array.isArray(names)) {
    const error = new Error("Player names must be provided as an array.");
    error.status = 400;
    throw error;
  }

  return [...new Set(names.map(cleanSearchTerm).filter((name) => name.length >= 2))]
    .slice(0, 25);
}

function quotePostgrestValue(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function cleanTextFilter(value) {
  return String(value || "")
    .trim()
    .replace(/[%*]/g, "")
    .slice(0, 80);
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

function toOptionalNumber(value) {
  const number = toNumber(value);
  return number === null ? null : number;
}

function clampNumber(value, min, max, fallback) {
  const number = toOptionalNumber(value);
  if (number === null) return fallback;

  return Math.min(Math.max(number, min), max);
}

function pickNumber(inputValue, presetValue = null) {
  const number = toOptionalNumber(inputValue);
  return number === null ? presetValue : number;
}

function appendRangeFilter(params, column, minValue, maxValue, options = {}) {
  const filters = [];

  if (options.nonNegative) {
    filters.push("gte.0");
  }

  if (minValue !== null && minValue !== undefined) {
    filters.push(`gte.${minValue}`);
  }

  if (maxValue !== null && maxValue !== undefined) {
    filters.push(`lte.${maxValue}`);
  }

  if (filters.length === 1) {
    params[column] = filters[0];
  } else if (filters.length > 1) {
    params[column] = filters;
  }
}

function normalizePosition(value) {
  const rawPosition = cleanTextFilter(value);
  const upperPosition = rawPosition.toUpperCase();
  const lowerPosition = rawPosition.toLowerCase();

  if (!rawPosition) {
    return {
      value: "",
      columns: [],
      textFallback: "",
    };
  }

  if (POSITION_GROUPS[lowerPosition]) {
    return {
      value: lowerPosition,
      columns: POSITION_GROUPS[lowerPosition],
      textFallback: "",
    };
  }

  if (POSITION_COLUMNS.includes(upperPosition)) {
    return {
      value: upperPosition,
      columns: [upperPosition],
      textFallback: "",
    };
  }

  return {
    value: rawPosition,
    columns: [],
    textFallback: rawPosition,
  };
}

function normalizeFilters(input = {}) {
  const presetKey = cleanTextFilter(input.preset).toLowerCase();
  const preset = PRESET_FILTERS[presetKey] ? presetKey : "";
  const presetFilters = preset ? PRESET_FILTERS[preset] : {};
  const name = cleanTextFilter(input.name || input.q || input.player);
  const sortKey = cleanTextFilter(input.sort || presetFilters.sort).toLowerCase();
  const position = normalizePosition(input.position);

  if (name && name.length < 2) {
    const error = new Error("Player search must contain at least 2 characters.");
    error.status = 400;
    throw error;
  }

  return {
    name,
    club: cleanTextFilter(input.club),
    nationality: cleanTextFilter(input.nationality),
    position,
    preset,
    minAge: pickNumber(input.minAge, presetFilters.minAge),
    maxAge: pickNumber(input.maxAge, presetFilters.maxAge),
    minCA: pickNumber(input.minCA, presetFilters.minCA),
    maxCA: pickNumber(input.maxCA, presetFilters.maxCA),
    minPA: pickNumber(input.minPA, presetFilters.minPA),
    maxPA: pickNumber(input.maxPA, presetFilters.maxPA),
    maxValue: pickNumber(input.maxValue, presetFilters.maxValue),
    maxSalary: pickNumber(input.maxSalary, presetFilters.maxSalary),
    sort: SORT_OPTIONS[sortKey] ? sortKey : "ability_desc",
    limit: clampNumber(input.limit, 1, MAX_LIMIT, DEFAULT_LIMIT),
  };
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

function buildSearchParams(filters) {
  const params = {
    select: "*",
    limit: filters.limit,
    order: SORT_OPTIONS[filters.sort],
  };
  const nameColumn = NAME_COLUMNS[0] || "Name";

  if (filters.name) {
    params[nameColumn] = `ilike.*${filters.name}*`;
  }

  if (filters.club) {
    params.Club = `ilike.*${filters.club}*`;
  }

  if (filters.nationality) {
    params.Nationality = `ilike.*${filters.nationality}*`;
  }

  if (filters.position.columns.length === 1) {
    params[filters.position.columns[0]] = `gte.${MIN_POSITION_SCORE}`;
  } else if (filters.position.columns.length > 1) {
    params.or = `(${filters.position.columns
      .map((column) => `${column}.gte.${MIN_POSITION_SCORE}`)
      .join(",")})`;
  } else if (filters.position.textFallback) {
    params.Position = `ilike.*${filters.position.textFallback}*`;
  }

  appendRangeFilter(params, "Age", filters.minAge, filters.maxAge);
  appendRangeFilter(params, "ca", filters.minCA, filters.maxCA);
  appendRangeFilter(params, "pa", filters.minPA, filters.maxPA);
  appendRangeFilter(params, "Values", null, filters.maxValue, {
    nonNegative: filters.maxValue !== null,
  });
  appendRangeFilter(params, "Salary", null, filters.maxSalary, {
    nonNegative: filters.maxSalary !== null,
  });

  return params;
}

async function searchPlayers(input = {}) {
  const filters = normalizeFilters(input);
  const params = buildSearchParams(filters);
  const rows = await supabaseRequest(PLAYER_TABLE, params);

  return {
    table: PLAYER_TABLE,
    count: rows.length,
    filters: {
      ...filters,
      position: filters.position.value,
    },
    players: rows.map(formatPlayer),
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

async function lookupPlayersByNames(names) {
  const normalizedNames = normalizePlayerNames(names);

  if (!normalizedNames.length) {
    return { players: [] };
  }

  const nameFilter = `in.(${normalizedNames.map(quotePostgrestValue).join(",")})`;
  let lastError = null;

  for (const column of NAME_COLUMNS) {
    try {
      const rows = await supabaseRequest(PLAYER_TABLE, {
        select: "*",
        [column]: nameFilter,
        limit: normalizedNames.length,
      });

      return { players: rows.map(formatPlayer) };
    } catch (error) {
      lastError = error;
      if (error.status !== 400 && error.status !== 404) {
        throw error;
      }
    }
  }

  const error = new Error(`Could not look up players in table "${PLAYER_TABLE}".`);
  error.status = lastError?.status || 500;
  error.details = lastError?.details;
  throw error;
}

module.exports = {
  lookupPlayersByNames,
  normalizePlayerNames,
  searchPlayers,
  searchPlayersByName,
};
