import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
  Spin,
  Typography,
} from "antd";
import {
  BarChartOutlined,
  FilterOutlined,
  LoadingOutlined,
  ReloadOutlined,
  RiseOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  StarFilled,
  StarOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";
import {
  getPlayerKey,
  loadShortlist,
  removeShortlistItem,
  upsertShortlistPlayer,
} from "../services/scoutingData";
import { searchPlayers } from "../services/api";
import PlayerAvatar from "../services/playerImages.jsx";

const { Text } = Typography;

const LAST_PLAYER_RESULT_STORAGE_KEY = "scoutai.lastPlayerResult";
const PLAYER_SESSION_CHANGE_EVENT = "scoutai-player-session-change";
const PLAYER_PAGE_SIZE = 24;
const PLAYER_MAX_RESULTS = 50;

const playerBrowserDefaults = {
  position: "",
  preset: "",
};

const valueOptions = [
  { label: "GBP 1m", value: 1000000 },
  { label: "GBP 5m", value: 5000000 },
  { label: "GBP 10m", value: 10000000 },
  { label: "GBP 25m", value: 25000000 },
  { label: "GBP 50m", value: 50000000 },
  { label: "GBP 100m", value: 100000000 },
];

const wageValues = [
  ["GBP 25k", 25000],
  ["GBP 50k", 50000],
  ["GBP 100k", 100000],
  ["GBP 250k", 250000],
  ["GBP 500k", 500000],
];

function formatMoney(value, t) {
  if (!value || value < 0) return t("players.unknown");

  return new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(value);
}

const nationalityFlags = {
  argentina: "🇦🇷",
  belgium: "🇧🇪",
  brazil: "🇧🇷",
  croatia: "🇭🇷",
  denmark: "🇩🇰",
  egypt: "🇪🇬",
  england: "🇬🇧",
  france: "🇫🇷",
  germany: "🇩🇪",
  italy: "🇮🇹",
  netherlands: "🇳🇱",
  norway: "🇳🇴",
  poland: "🇵🇱",
  portugal: "🇵🇹",
  spain: "🇪🇸",
  uruguay: "🇺🇾",
};

function getNationalityFlag(value) {
  return nationalityFlags[String(value || "").trim().toLocaleLowerCase()] || "🌐";
}

function flagFromCountryCode(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedCode)) return "";

  return [...normalizedCode]
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function normalizeNationalityValues(value) {
  return String(value || "")
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const codeMatch = part.match(/^([A-Z]{2})(?=[A-Z][a-z])/);
      const code = codeMatch?.[1] || "";
      const label = code ? part.slice(2).trim() : part;

      return {
        code,
        label,
        value: label,
      };
    })
    .filter((item) => item.label);
}

function getSuggestionImageUrl(player, field) {
  const raw = player?.raw || {};
  const candidates =
    field === "club"
      ? [
          player?.clubLogoUrl,
          player?.club_logo_url,
          raw.ClubLogoUrl,
          raw.club_logo_url,
        ]
      : [
          player?.nationalityImageUrl,
          player?.flagUrl,
          raw.NationalityImageUrl,
          raw.flag_url,
        ];

  return candidates.find((candidate) => String(candidate || "").trim()) || "";
}

function FilterSuggestionOption({ description, fallback, imageUrl, title }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <span className="filter-suggestion-option">
      <span className={`filter-suggestion-media${showImage ? " has-image" : ""}`}>
        {showImage ? (
          <img
            alt=""
            onError={() => setImageFailed(true)}
            src={imageUrl}
          />
        ) : (
          fallback
        )}
      </span>
      <span className="filter-suggestion-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </span>
  );
}

function pickPlayerValue(player, keys, fallback = null) {
  for (const key of keys) {
    const value = player?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function normalizeSavedPlayer(item) {
  const snapshot =
    item?.snapshot && typeof item.snapshot === "object" ? item.snapshot : {};

  return {
    ...snapshot,
    age: pickPlayerValue(snapshot, ["age", "Age"], item?.age),
    club: pickPlayerValue(snapshot, ["club", "Club"], item?.club),
    currentAbility: pickPlayerValue(snapshot, [
      "currentAbility",
      "CurrentAbility",
      "ca",
      "CA",
    ]),
    marketValue: pickPlayerValue(
      snapshot,
      ["marketValue", "MarketValue", "Values", "market_value"],
      item?.market_value
    ),
    name: pickPlayerValue(
      snapshot,
      ["name", "Name", "playerName", "player_name"],
      item?.player_name
    ),
    nationality: pickPlayerValue(
      snapshot,
      ["nationality", "Nationality"],
      item?.nationality
    ),
    position: pickPlayerValue(
      snapshot,
      ["position", "Position", "FullPosition"],
      item?.position
    ),
    potentialAbility: pickPlayerValue(snapshot, [
      "potentialAbility",
      "PotentialAbility",
      "pa",
      "PA",
    ]),
    salary: pickPlayerValue(snapshot, ["salary", "Salary"]),
    uid: pickPlayerValue(
      snapshot,
      ["uid", "UID", "id", "player_uid"],
      item?.player_uid
    ),
  };
}

function PlayerProfileCard({
  isSaved,
  isSaving,
  onAnalyze,
  onToggleSaved,
  player,
}) {
  const { t } = useTranslation(["search", "result"]);
  const saveLabel = isSaved
    ? t("shortlist.removeAria", { name: player.name, ns: "search" })
    : `${t("actions.save", { ns: "result" })}: ${player.name}`;

  return (
    <article className="player-profile-card">
      <PlayerAvatar
        alt={player.name}
        className="player-profile-card-image"
        name={player.name}
        uid={player.uid}
      />
      <span className="player-profile-card-overlay" aria-hidden="true" />
      <button
        aria-label={`${t("actions.analyze", { ns: "search" })} ${player.name}`}
        className="player-profile-card-open"
        onClick={() => onAnalyze(player.name)}
        type="button"
      />
      <button
        aria-label={saveLabel}
        className={`player-profile-card-save${isSaved ? " is-saved" : ""}`}
        disabled={isSaving}
        onClick={onToggleSaved}
        title={saveLabel}
        type="button"
      >
        {isSaving ? (
          <LoadingOutlined spin />
        ) : isSaved ? (
          <StarFilled />
        ) : (
          <StarOutlined />
        )}
      </button>
      <strong className="player-profile-card-position">
        {player.position || "-"}
      </strong>
      <div className="player-profile-card-identity">
        <h3>{player.name}</h3>
        <i className="player-profile-card-accent" aria-hidden="true" />
        <div className="player-profile-card-details">
          <span>
            <b aria-hidden="true">{getNationalityFlag(player.nationality)}</b>
            {player.nationality || t("players.unknown", { ns: "search" })}
          </span>
          <span>
            <b className="player-profile-card-club-mark" aria-hidden="true">⚽</b>
            {player.club || t("players.unknown", { ns: "search" })}
          </span>
        </div>
      </div>
      <div className="player-profile-card-metrics">
        <span>
          <RiseOutlined aria-hidden="true" />
          <span>
            <small>CA / PA</small>
            <strong>
              {player.currentAbility ?? "-"} / {player.potentialAbility ?? "-"}
            </strong>
          </span>
        </span>
        <span>
          <BarChartOutlined aria-hidden="true" />
          <span>
            <small>{t("players.value", { ns: "search" })}</small>
            <strong>{formatMoney(player.marketValue, t)}</strong>
          </span>
        </span>
        <span>
          <WalletOutlined aria-hidden="true" />
          <span>
            <small>{t("players.wage", { ns: "search" })}</small>
            <strong>
              {player.salary
                ? formatMoney(player.salary, t)
                : t("players.unknown", { ns: "search" })}
            </strong>
          </span>
        </span>
        <span>
          <UserOutlined aria-hidden="true" />
          <span>
            <small>{t("players.age", { ns: "search" })}</small>
            <strong>{player.age ?? "-"}</strong>
          </span>
        </span>
      </div>
    </article>
  );
}

function buildBrowserParams(values, limit = PLAYER_PAGE_SIZE) {
  return {
    ...values,
    limit,
  };
}

function readDataError(error, t) {
  const message = error?.message || t("errors.workspace");
  if (
    error?.response?.status === 401 ||
    message.includes("Authentication is required")
  ) {
    return t("errors.authentication");
  }

  if (message.includes("Shortlist delete was not applied")) {
    return t("errors.shortlistDeleteMigration");
  }

  if (
    message.includes("player_search_history") ||
    message.includes("row-level security policy")
  ) {
    return t("errors.historyPolicyMigration");
  }

  if (
    message.includes("player_shortlist") ||
    message.includes("player_search_history") ||
    message.includes("Could not find the table")
  ) {
    return t("errors.workspaceMigration");
  }

  return message;
}

function writeLastPlayerResult(playerName) {
  try {
    const cleanedName = String(playerName || "").trim();

    if (cleanedName) {
      window.sessionStorage.setItem(LAST_PLAYER_RESULT_STORAGE_KEY, cleanedName);
    }
  } catch {
    // Ignore storage failures; navigation still works for the current click.
  }

  window.dispatchEvent(new Event(PLAYER_SESSION_CHANGE_EVENT));
}

function formatSavedSource(source, t) {
  const cleanedSource = String(source || "").trim();
  const normalizedSource = cleanedSource.toLocaleLowerCase();

  if (
    !cleanedSource ||
    normalizedSource === "manual" ||
    normalizedSource === "โน้ตแมวมอง" ||
    normalizedSource === "บันทึกเอง"
  ) {
    return t("sources.manual");
  }

  if (
    normalizedSource === "ai shortlist" ||
    normalizedSource === "ai scout shortlist" ||
    normalizedSource === "รายชื่อ ai แมวมอง" ||
    normalizedSource === "แนะนำโดย ai"
  ) {
    return t("sources.aiShortlist");
  }

  if (
    normalizedSource === "target player" ||
    normalizedSource === "นักเตะเป้าหมาย"
  ) {
    return t("sources.targetPlayer");
  }

  const thaiModelCandidateMatch = cleanedSource.match(
    /^ตัวเลือกแมวมองจาก\s+(.+)$/i
  );

  if (thaiModelCandidateMatch) {
    return t("sources.modelCandidate", {
      model: thaiModelCandidateMatch[1].trim(),
    });
  }

  const recommendedByMatch = cleanedSource.match(/^แนะนำโดย\s+(.+)$/i);

  if (recommendedByMatch) {
    return t("sources.modelCandidate", {
      model: recommendedByMatch[1].trim(),
    });
  }

  const modelCandidateMatch = cleanedSource.match(
    /^(.*?)(?:\s+scouting)?\s+candidate$/i
  );

  if (modelCandidateMatch) {
    return t("sources.modelCandidate", {
      model: modelCandidateMatch[1].trim(),
    });
  }

  return cleanedSource;
}

function ShortlistPanel({
  emptyDescription,
  items,
  onAnalyze,
  onToggleSaved,
  savingPlayerKeys,
}) {
  const { t } = useTranslation("search");

  if (!items.length) {
    return (
      <Empty
        className="player-card-empty"
        description={emptyDescription || t("shortlist.empty")}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div className="player-card-grid saved-player-card-grid">
      {items.map((item) => {
        const player = normalizeSavedPlayer(item);
        const playerKey = getPlayerKey(player);

        return (
          <PlayerProfileCard
            isSaved
            isSaving={savingPlayerKeys.has(playerKey)}
            key={item.id || playerKey}
            onAnalyze={onAnalyze}
            onToggleSaved={() => onToggleSaved(player, item)}
            player={player}
          />
        );
      })}
    </div>
  );
}

function PlayerDatabasePanel({
  activeView,
  onAnalyze,
  onRemoveSaved,
  onSavePlayer,
  onViewChange,
  savedItems,
  savedLoading,
}) {
  const { t } = useTranslation("search");
  const [browserForm] = Form.useForm();
  const [savedFilterForm] = Form.useForm();
  const browserRequestController = useRef(null);
  const browserRequestId = useRef(0);
  const suggestionControllers = useRef({ club: null, nationality: null });
  const suggestionTimers = useRef({ club: null, nationality: null });
  const [nameSearch, setNameSearch] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSavedFilterOpen, setIsSavedFilterOpen] = useState(false);
  const [savedSearchInput, setSavedSearchInput] = useState("");
  const [savedSearch, setSavedSearch] = useState("");
  const [savedSort, setSavedSort] = useState("saved_desc");
  const [savedFilters, setSavedFilters] = useState({
    club: "",
    position: "",
    source: "",
  });
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [savingPlayerKeys, setSavingPlayerKeys] = useState(() => new Set());
  const [filterFeedback, setFilterFeedback] = useState({
    status: "",
    text: "",
  });
  const [filterSuggestions, setFilterSuggestions] = useState({
    club: [],
    nationality: [],
  });
  const [suggestionLoading, setSuggestionLoading] = useState({
    club: false,
    nationality: false,
  });
  const [browserState, setBrowserState] = useState({
    loading: false,
    error: "",
    players: [],
    count: 0,
    limit: PLAYER_PAGE_SIZE,
  });
  const presetOptions = [
    { label: t("options.presets.none"), value: "" },
    { label: t("options.presets.wonderkids"), value: "wonderkids" },
    { label: t("options.presets.bargains"), value: "bargains" },
    { label: t("options.presets.elite"), value: "elite" },
  ];
  const positionOptions = [
    { label: t("options.positions.any"), value: "" },
    { label: t("options.positions.goalkeeper"), value: "goalkeeper" },
    { label: t("options.positions.defender"), value: "defender" },
    { label: t("options.positions.fullback"), value: "fullback" },
    { label: t("options.positions.midfielder"), value: "midfielder" },
    { label: t("options.positions.playmaker"), value: "playmaker" },
    { label: t("options.positions.winger"), value: "winger" },
    { label: t("options.positions.striker"), value: "striker" },
  ];
  const wageOptions = wageValues.map(([valueLabel, value]) => ({
    label: t("players.wagePerWeek", { value: valueLabel }),
    value,
  }));
  const sortOptions = [
    { label: t("options.sort.ability"), value: "ability_desc" },
    { label: t("options.sort.potential"), value: "potential_desc" },
    { label: t("options.sort.value"), value: "value_asc" },
    { label: t("options.sort.wage"), value: "wage_asc" },
    { label: t("options.sort.age"), value: "age_asc" },
    { label: t("options.sort.name"), value: "name_asc" },
  ];
  const selectedSort = Form.useWatch("sort", browserForm) || "";
  const selectedSortLabel =
    sortOptions.find((option) => option.value === selectedSort)?.label ||
    t("filters.defaultOrder");
  const sortMenuItems = [
    { key: "default", label: t("filters.defaultOrder") },
    ...sortOptions.map((option) => ({
      key: option.value,
      label: option.label,
    })),
  ];
  const savedSortOptions = [
    { label: t("shortlist.sort.newest"), value: "saved_desc" },
    { label: t("shortlist.sort.oldest"), value: "saved_asc" },
    { label: t("shortlist.sort.nameAsc"), value: "name_asc" },
    { label: t("shortlist.sort.nameDesc"), value: "name_desc" },
    { label: t("shortlist.sort.clubAsc"), value: "club_asc" },
  ];
  const savedSortLabel =
    savedSortOptions.find((option) => option.value === savedSort)?.label ||
    savedSortOptions[0].label;
  const savedSortMenuItems = savedSortOptions.map((option) => ({
    key: option.value,
    label: option.label,
  }));
  const normalizedSavedItems = savedItems || [];
  const savedItemByKey = new Map(
    normalizedSavedItems.map((item) => [
      item.player_key || getPlayerKey(item),
      item,
    ])
  );

  function buildSavedOptions(key, labelFormatter = (value) => value) {
    return [...new Set(normalizedSavedItems.map((item) => item[key]).filter(Boolean))]
      .sort((left, right) => String(left).localeCompare(String(right)))
      .map((value) => ({
        label: labelFormatter(value),
        value,
      }));
  }

  const savedClubOptions = buildSavedOptions("club");
  const savedPositionOptions = buildSavedOptions("position");
  const savedSourceOptions = buildSavedOptions("source", (source) =>
    formatSavedSource(source, t)
  );

  function buildFilterSuggestionOptions(field, players = []) {
    const values = new Map();

    players.forEach((player) => {
      const rawValue = String(player?.[field] || "").trim();
      const entries =
        field === "nationality"
          ? normalizeNationalityValues(rawValue)
          : [{ code: "", label: rawValue, value: rawValue }];

      entries.forEach((entry) => {
        const key = entry.value.toLocaleLowerCase();
        if (!entry.value || values.has(key)) return;

        values.set(key, {
          ...entry,
          imageUrl: getSuggestionImageUrl(player, field),
        });
      });
    });

    return [...values.values()]
      .sort((left, right) => left.label.localeCompare(right.label))
      .slice(0, 12)
      .map((entry) => ({
        label: (
          <FilterSuggestionOption
            description={t(
              field === "nationality" ? "filters.nationality" : "filters.club"
            )}
            fallback={
              field === "nationality" ? (
                <span aria-hidden="true">
                  {flagFromCountryCode(entry.code) ||
                    getNationalityFlag(entry.label)}
                </span>
              ) : (
                <TeamOutlined />
              )
            }
            imageUrl={entry.imageUrl}
            title={entry.label}
          />
        ),
        value: entry.value,
      }));
  }

  function requestFilterSuggestions(field, input = "") {
    const query = String(input || "").trim();
    const localPlayers = browserState.players.filter((player) => {
      const value = String(player?.[field] || "").toLocaleLowerCase();
      return !query || value.includes(query.toLocaleLowerCase());
    });

    setFilterSuggestions((current) => ({
      ...current,
      [field]: buildFilterSuggestionOptions(field, localPlayers),
    }));

    clearTimeout(suggestionTimers.current[field]);
    suggestionControllers.current[field]?.abort();

    if (!query) {
      setSuggestionLoading((current) => ({ ...current, [field]: false }));
      return;
    }

    suggestionTimers.current[field] = setTimeout(async () => {
      const controller = new AbortController();
      suggestionControllers.current[field] = controller;
      setSuggestionLoading((current) => ({ ...current, [field]: true }));

      try {
        const result = await searchPlayers(
          { [field]: query, limit: 50, sort: "name_asc" },
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;

        setFilterSuggestions((current) => ({
          ...current,
          [field]: buildFilterSuggestionOptions(field, result.players),
        }));
      } catch {
        if (!controller.signal.aborted) {
          setFilterSuggestions((current) => ({
            ...current,
            [field]: buildFilterSuggestionOptions(field, localPlayers),
          }));
        }
      } finally {
        if (!controller.signal.aborted) {
          setSuggestionLoading((current) => ({ ...current, [field]: false }));
        }
      }
    }, 250);
  }
  const filteredSavedItems = normalizedSavedItems
    .filter((item) => {
      const searchableText = [
        item.player_name,
        item.club,
        item.position,
        item.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      const matchesSearch =
        !savedSearch || searchableText.includes(savedSearch.toLocaleLowerCase());
      const matchesClub = !savedFilters.club || item.club === savedFilters.club;
      const matchesPosition =
        !savedFilters.position || item.position === savedFilters.position;
      const matchesSource =
        !savedFilters.source || item.source === savedFilters.source;

      return matchesSearch && matchesClub && matchesPosition && matchesSource;
    })
    .sort((left, right) => {
      if (savedSort === "saved_asc") {
        return (Date.parse(left.updated_at) || 0) - (Date.parse(right.updated_at) || 0);
      }
      if (savedSort === "name_asc") {
        return String(left.player_name || "").localeCompare(
          String(right.player_name || "")
        );
      }
      if (savedSort === "name_desc") {
        return String(right.player_name || "").localeCompare(
          String(left.player_name || "")
        );
      }
      if (savedSort === "club_asc") {
        return String(left.club || "").localeCompare(String(right.club || ""));
      }
      return (Date.parse(right.updated_at) || 0) - (Date.parse(left.updated_at) || 0);
    });

  async function toggleSavedPlayer(player, savedItem = null) {
    const playerKey = getPlayerKey(player);
    if (!playerKey || savingPlayerKeys.has(playerKey)) return;

    setSavingPlayerKeys((keys) => new Set(keys).add(playerKey));

    try {
      if (savedItem) {
        await onRemoveSaved(savedItem.id);
      } else {
        await onSavePlayer(player);
      }
    } finally {
      setSavingPlayerKeys((keys) => {
        const nextKeys = new Set(keys);
        nextKeys.delete(playerKey);
        return nextKeys;
      });
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialPlayers() {
      const requestId = ++browserRequestId.current;
      const controller = new AbortController();
      browserRequestController.current?.abort();
      browserRequestController.current = controller;

      setBrowserState((state) => ({
        ...state,
        loading: true,
        error: "",
      }));

      try {
        const result = await searchPlayers(
          buildBrowserParams(playerBrowserDefaults, PLAYER_PAGE_SIZE),
          { signal: controller.signal }
        );
        if (!isActive || requestId !== browserRequestId.current) return;
        setBrowserState({
          loading: false,
          error: "",
          players: result.players || [],
          count: result.count || 0,
          limit: PLAYER_PAGE_SIZE,
        });
      } catch (loadError) {
        if (controller.signal.aborted) return;
        if (!isActive || requestId !== browserRequestId.current) return;
        setBrowserState({
          loading: false,
          error:
            loadError?.response?.data?.message ||
            loadError?.message ||
            t("errors.database"),
          players: [],
          count: 0,
          limit: PLAYER_PAGE_SIZE,
        });
      }
    }

    loadInitialPlayers();

    return () => {
      isActive = false;
      browserRequestController.current?.abort();
      browserRequestId.current += 1;
    };
  }, [t]);

  useEffect(() => {
    const controllers = suggestionControllers.current;
    const timers = suggestionTimers.current;

    return () => {
      clearTimeout(timers.club);
      clearTimeout(timers.nationality);
      controllers.club?.abort();
      controllers.nationality?.abort();
    };
  }, []);

  async function applyFilters(
    values,
    limit = PLAYER_PAGE_SIZE,
    successMessage = ""
  ) {
    const requestId = ++browserRequestId.current;
    const controller = new AbortController();
    browserRequestController.current?.abort();
    browserRequestController.current = controller;

    if (successMessage) {
      setIsApplyingFilters(true);
      setFilterFeedback({
        status: "loading",
        text:
          successMessage === t("feedback.filtersReset")
            ? t("feedback.resetting")
            : t("feedback.applying"),
      });
    }

    setBrowserState((state) => ({
      ...state,
      loading: true,
      error: "",
    }));

    try {
      const result = await searchPlayers(buildBrowserParams(values, limit), {
        signal: controller.signal,
      });
      if (requestId !== browserRequestId.current) return;

      setBrowserState({
        loading: false,
        error: "",
        players: result.players || [],
        count: result.count || 0,
        limit,
      });

      if (successMessage) {
        setFilterFeedback({
          status: "success",
          text: t("feedback.shown", {
            count: result.count || 0,
            message: successMessage,
          }),
        });
      }
      return true;
    } catch (filterError) {
      if (controller.signal.aborted) return;
      if (requestId !== browserRequestId.current) return;

      setBrowserState((state) => ({
        ...state,
        loading: false,
        error:
          filterError?.response?.data?.message ||
          filterError?.message ||
          t("errors.filter"),
      }));

      if (successMessage) {
        setFilterFeedback({
          status: "error",
          text: t("errors.apply"),
        });
      }
      return false;
    } finally {
      if (requestId === browserRequestId.current && successMessage) {
        setIsApplyingFilters(false);
      }
    }
  }

  function resetFilters() {
    setNameSearch("");
    browserForm.resetFields();
    applyFilters(
      playerBrowserDefaults,
      PLAYER_PAGE_SIZE,
      t("feedback.filtersReset")
    );
  }

  function changeSort(sortKey) {
    const sort = sortKey === "default" ? "" : sortKey;
    browserForm.setFieldValue("sort", sort);
    applyFilters(
      {
        ...browserForm.getFieldsValue(),
        name: nameSearch,
        sort,
      },
      PLAYER_PAGE_SIZE
    );
  }

  function searchSavedByName(value) {
    const cleanedName = String(value || "").trim();
    setSavedSearchInput(cleanedName);
    setSavedSearch(cleanedName);
  }

  function resetSavedFilters() {
    savedFilterForm.resetFields();
    setSavedFilters({
      club: "",
      position: "",
      source: "",
    });
  }

  function searchByName(value) {
    const cleanedName = String(value || "").trim();
    setNameSearch(cleanedName);
    applyFilters(
      {
        ...browserForm.getFieldsValue(),
        name: cleanedName,
      },
      PLAYER_PAGE_SIZE
    );
  }

  function loadMorePlayers() {
    const nextLimit = Math.min(
      browserState.limit + PLAYER_PAGE_SIZE,
      PLAYER_MAX_RESULTS
    );

    applyFilters(
      {
        ...browserForm.getFieldsValue(),
        name: nameSearch,
      },
      nextLimit
    );
  }

  const hasMorePlayers =
    browserState.players.length >= browserState.limit &&
    browserState.limit < PLAYER_MAX_RESULTS;

  return (
    <>
      <div className="player-browser-toolbar">
          <div className="player-view-switch">
            <Segmented
              className="player-view-tabs"
              onChange={onViewChange}
              options={[
                {
                  label: t("database.title"),
                  value: "database",
                },
                {
                  label: t("shortlist.savedPlayers"),
                  value: "saved",
                },
              ]}
              value={activeView}
            />
          </div>
          {activeView === "database" && (
            <div className="database-header-controls">
              <div className="database-name-search" role="search">
              <Button
                aria-label={t("database.searchAria")}
                className="database-name-search-button"
                icon={<SearchOutlined />}
                loading={browserState.loading}
                onClick={() => searchByName(nameSearch)}
                shape="circle"
              />
              <Input
                allowClear
                aria-label={t("database.searchPlaceholder")}
                onChange={(event) => {
                  const value = event.target.value;
                  setNameSearch(value);
                  if (!value) searchByName("");
                }}
                onPressEnter={() => searchByName(nameSearch)}
                placeholder={t("database.searchPlaceholder")}
                value={nameSearch}
              />
            </div>
            <Dropdown
              menu={{
                items: sortMenuItems,
                onClick: ({ key }) => changeSort(key),
                selectable: true,
                selectedKeys: [selectedSort || "default"],
              }}
              placement="bottomRight"
              trigger={["click"]}
            >
              <Button
                className="player-sort-trigger"
                icon={<SortAscendingOutlined />}
              >
                {selectedSortLabel}
              </Button>
            </Dropdown>
            <Button
              className="player-filter-trigger"
              icon={<FilterOutlined />}
              onClick={() => setIsFilterOpen(true)}
            >
              {t("filters.title")}
              </Button>
            </div>
          )}
          {activeView === "saved" && (
            <div className="database-header-controls saved-header-controls">
              <div className="database-name-search" role="search">
                <Button
                  aria-label={t("shortlist.searchAria")}
                  className="database-name-search-button"
                  icon={<SearchOutlined />}
                  loading={savedLoading}
                  onClick={() => searchSavedByName(savedSearchInput)}
                  shape="circle"
                />
                <Input
                  allowClear
                  aria-label={t("shortlist.searchAria")}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSavedSearchInput(value);
                    if (!value) searchSavedByName("");
                  }}
                  onPressEnter={() => searchSavedByName(savedSearchInput)}
                  placeholder={t("shortlist.searchPlaceholder")}
                  value={savedSearchInput}
                />
              </div>
              <Dropdown
                menu={{
                  items: savedSortMenuItems,
                  onClick: ({ key }) => setSavedSort(key),
                  selectable: true,
                  selectedKeys: [savedSort],
                }}
                placement="bottomRight"
                trigger={["click"]}
              >
                <Button
                  className="player-sort-trigger"
                  icon={<SortAscendingOutlined />}
                >
                  {savedSortLabel}
                </Button>
              </Dropdown>
              <Button
                className="player-filter-trigger"
                icon={<FilterOutlined />}
                onClick={() => setIsSavedFilterOpen(true)}
              >
                {t("filters.title")}
              </Button>
            </div>
          )}
      </div>
      <Card className="player-browser-card player-browser-surface">
      <div
        className="player-database-grid"
        hidden={activeView !== "database"}
      >
        <Drawer
          className="player-filter-drawer"
          destroyOnHidden
          footer={null}
          onClose={() => setIsFilterOpen(false)}
          open={isFilterOpen}
          placement="right"
          rootClassName="player-filter-drawer-root"
          title={
            <div className="player-filter-drawer-heading">
              <span>
                <FilterOutlined />
                {t("filters.title")}
              </span>
              <small>{t("filters.count")}</small>
            </div>
          }
          width="min(480px, 100vw)"
        >
          <div className="player-filter-drawer-intro">
            <Text type="secondary">
              {t("filters.description")}
            </Text>
          </div>

          <Form
            form={browserForm}
            initialValues={playerBrowserDefaults}
            layout="vertical"
            onFinish={async (values) => {
              const didApply = await applyFilters(
                {
                  ...values,
                  name: nameSearch,
                },
                PLAYER_PAGE_SIZE,
                t("feedback.filtersApplied")
              );
              if (didApply) setIsFilterOpen(false);
            }}
            requiredMark={false}
          >
            <div className="player-filter-scroll">
              <div className="player-filter-grid">
                <Form.Item label={t("filters.club")} name="club">
                  <AutoComplete
                    allowClear
                    classNames={{ popup: { root: "player-filter-suggestions" } }}
                    notFoundContent={
                      suggestionLoading.club ? <Spin size="small" /> : null
                    }
                    onFocus={() =>
                      requestFilterSuggestions(
                        "club",
                        browserForm.getFieldValue("club")
                      )
                    }
                    onSearch={(value) => requestFilterSuggestions("club", value)}
                    options={filterSuggestions.club}
                    placeholder={t("filters.clubPlaceholder")}
                  />
                </Form.Item>

                <Form.Item label={t("filters.nationality")} name="nationality">
                  <AutoComplete
                    allowClear
                    classNames={{ popup: { root: "player-filter-suggestions" } }}
                    notFoundContent={
                      suggestionLoading.nationality ? <Spin size="small" /> : null
                    }
                    onFocus={() =>
                      requestFilterSuggestions(
                        "nationality",
                        browserForm.getFieldValue("nationality")
                      )
                    }
                    onSearch={(value) =>
                      requestFilterSuggestions("nationality", value)
                    }
                    options={filterSuggestions.nationality}
                    placeholder={t("filters.nationalityPlaceholder")}
                  />
                </Form.Item>

                <Form.Item label={t("filters.position")} name="position">
                  <Select options={positionOptions} />
                </Form.Item>

                <Form.Item label={t("filters.preset")} name="preset">
                  <Select
                    onChange={(preset) =>
                      applyFilters(
                        {
                          ...browserForm.getFieldsValue(),
                          name: nameSearch,
                          preset,
                        },
                        PLAYER_PAGE_SIZE,
                        t("feedback.presetApplied")
                      )
                    }
                    options={presetOptions}
                  />
                </Form.Item>

                <Form.Item label={t("filters.minAge")} name="minAge">
                  <InputNumber max={45} min={15} placeholder="18" />
                </Form.Item>

                <Form.Item label={t("filters.maxAge")} name="maxAge">
                  <InputNumber max={45} min={15} placeholder="24" />
                </Form.Item>

                <Form.Item label={t("filters.minCA")} name="minCA">
                  <InputNumber max={200} min={1} placeholder="130" />
                </Form.Item>

                <Form.Item label={t("filters.minPA")} name="minPA">
                  <InputNumber max={200} min={1} placeholder="150" />
                </Form.Item>

                <Form.Item label={t("filters.maxValue")} name="maxValue">
                  <Select
                    allowClear
                    options={valueOptions}
                    placeholder={t("filters.anyBudget")}
                  />
                </Form.Item>

                <Form.Item label={t("filters.maxWage")} name="maxSalary">
                  <Select
                    allowClear
                    options={wageOptions}
                    placeholder={t("filters.anyWage")}
                  />
                </Form.Item>

                <Form.Item label={t("filters.sortBy")} name="sort">
                  <Select
                    allowClear
                    options={sortOptions}
                    placeholder={t("filters.defaultOrder")}
                  />
                </Form.Item>
              </div>
            </div>

            <div className="player-filter-actions">
              <Button
                htmlType="submit"
                icon={
                  isApplyingFilters ? (
                    <LoadingOutlined spin />
                  ) : (
                    <FilterOutlined />
                  )
                }
                type="primary"
              >
                {isApplyingFilters
                  ? t("actions.applying")
                  : t("actions.apply")}
              </Button>
              <Button icon={<ReloadOutlined />} onClick={resetFilters}>
                {t("actions.reset")}
              </Button>
              <span
                aria-live="polite"
                className={`player-filter-feedback is-${filterFeedback.status}`}
                role="status"
              >
                {filterFeedback.text}
              </span>
            </div>
          </Form>
        </Drawer>

        <div className="player-results-area">
          <div className="player-results-toolbar">
            <div>
              <strong>{t("database.matching")}</strong>
              <span>
                {t("database.profilesInView", { count: browserState.count })}
              </span>
            </div>
            <span className="ability-legend">
              <i className="is-current" />
              {t("players.current")}
              <i className="is-potential" />
              PA
            </span>
          </div>

          {browserState.error && (
            <Alert
              message={browserState.error}
              showIcon
              style={{ marginBottom: 16 }}
              type="warning"
            />
          )}

          {browserState.loading ? (
            <div className="player-card-loading">
              <Spin />
            </div>
          ) : browserState.players.length ? (
            <div className="player-card-grid">
              {browserState.players.map((player) => {
                const playerKey = getPlayerKey(player);
                const savedItem = savedItemByKey.get(playerKey);

                return (
                  <PlayerProfileCard
                    isSaved={Boolean(savedItem)}
                    isSaving={savingPlayerKeys.has(playerKey)}
                    key={player.uid || player.id || player.name}
                    onAnalyze={onAnalyze}
                    onToggleSaved={() => toggleSavedPlayer(player, savedItem)}
                    player={player}
                  />
                );
              })}
            </div>
          ) : (
            <Empty
              className="player-card-empty"
              description={t("database.noMatches")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
          <div className="player-load-more">
            <Button
              disabled={!hasMorePlayers}
              loading={browserState.loading}
              onClick={loadMorePlayers}
            >
              {t("actions.loadMore")}
            </Button>
          </div>
        </div>
      </div>
      <div className="saved-player-view" hidden={activeView !== "saved"}>
        <Drawer
          className="player-filter-drawer saved-filter-drawer"
          destroyOnHidden
          footer={null}
          onClose={() => setIsSavedFilterOpen(false)}
          open={isSavedFilterOpen}
          placement="right"
          rootClassName="player-filter-drawer-root"
          title={
            <div className="player-filter-drawer-heading">
              <span>
                <FilterOutlined />
                {t("shortlist.filtersTitle")}
              </span>
              <small>{t("shortlist.filterCount")}</small>
            </div>
          }
          width="min(440px, 100vw)"
        >
          <div className="player-filter-drawer-intro">
            <Text type="secondary">
              {t("shortlist.filtersDescription")}
            </Text>
          </div>
          <Form
            form={savedFilterForm}
            initialValues={{ club: "", position: "", source: "" }}
            layout="vertical"
            onFinish={(values) => {
              setSavedFilters(values);
              setIsSavedFilterOpen(false);
            }}
            requiredMark={false}
          >
            <div className="player-filter-grid">
              <Form.Item label={t("filters.club")} name="club">
                <Select
                  allowClear
                  options={savedClubOptions}
                  placeholder={t("shortlist.anyClub")}
                  showSearch
                />
              </Form.Item>
              <Form.Item label={t("filters.position")} name="position">
                <Select
                  allowClear
                  options={savedPositionOptions}
                  placeholder={t("shortlist.anyPosition")}
                  showSearch
                />
              </Form.Item>
              <Form.Item label={t("players.source")} name="source">
                <Select
                  allowClear
                  options={savedSourceOptions}
                  placeholder={t("shortlist.anySource")}
                  showSearch
                />
              </Form.Item>
            </div>
            <div className="player-filter-actions">
              <Button htmlType="submit" icon={<FilterOutlined />} type="primary">
                {t("actions.apply")}
              </Button>
              <Button icon={<ReloadOutlined />} onClick={resetSavedFilters}>
                {t("actions.reset")}
              </Button>
            </div>
          </Form>
        </Drawer>
        {savedLoading ? (
          <div className="saved-player-loading">
            <Spin />
            <Text type="secondary">{t("hero.loading")}</Text>
          </div>
        ) : (
          <ShortlistPanel
            emptyDescription={
              normalizedSavedItems.length
                ? t("shortlist.noMatches")
                : t("shortlist.empty")
            }
            items={filteredSavedItems}
            onAnalyze={onAnalyze}
            onToggleSaved={toggleSavedPlayer}
            savingPlayerKeys={savingPlayerKeys}
          />
        )}
      </div>
      </Card>
    </>
  );
}

function Search() {
  const { t } = useTranslation("search");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activePlayerView, setActivePlayerView] = useState("database");
  const [workspaceState, setWorkspaceState] = useState({
    loading: true,
    error: "",
    shortlist: [],
  });

  useEffect(() => {
    let isActive = true;

    if (!user?.id) {
      setWorkspaceState({
        loading: false,
        error: "",
        shortlist: [],
      });
      return () => {
        isActive = false;
      };
    }

    setWorkspaceState((state) => ({
      ...state,
      loading: true,
      error: "",
    }));

    loadShortlist(user.id)
      .then((shortlist) => {
        if (!isActive) return;
        setWorkspaceState({
          loading: false,
          error: "",
          shortlist,
        });
      })
      .catch((workspaceError) => {
        if (!isActive) return;
        setWorkspaceState({
          loading: false,
          error: readDataError(workspaceError, t),
          shortlist: [],
        });
      });

    return () => {
      isActive = false;
    };
  }, [t, user?.id]);

  function startAnalysis(name) {
    const cleanedName = String(name || "").trim();
    if (cleanedName.length < 2) {
      setWorkspaceState((state) => ({
        ...state,
        error: t("errors.selectPlayer"),
      }));
      return;
    }

    writeLastPlayerResult(cleanedName);
    navigate(`/result?${new URLSearchParams({ player: cleanedName })}`);
  }

  async function saveShortlist(player) {
    if (!user?.id) {
      setWorkspaceState((state) => ({
        ...state,
        error: t("errors.authentication"),
      }));
      return;
    }

    try {
      await upsertShortlistPlayer(user.id, player, "manual");
      const shortlist = await loadShortlist(user.id);
      setWorkspaceState((state) => ({ ...state, error: "", shortlist }));
    } catch (saveError) {
      setWorkspaceState((state) => ({
        ...state,
        error: readDataError(saveError, t),
      }));
    }
  }

  async function removeShortlist(id) {
    if (!user?.id) return;

    try {
      await removeShortlistItem(user.id, id);
      const shortlist = await loadShortlist(user.id);
      setWorkspaceState((state) => ({ ...state, error: "", shortlist }));
    } catch (removeError) {
      setWorkspaceState((state) => ({
        ...state,
        error: readDataError(removeError, t),
      }));
    }
  }

  return (
    <AppShell>
      <div className="search-workspace">
        {workspaceState.error && (
          <Alert
            message={workspaceState.error}
            showIcon
            style={{ marginBottom: 16 }}
            type="warning"
          />
        )}

        <section className="database-section" id="workspace">
          <PlayerDatabasePanel
            activeView={activePlayerView}
            onAnalyze={startAnalysis}
            onRemoveSaved={removeShortlist}
            onSavePlayer={saveShortlist}
            onViewChange={setActivePlayerView}
            savedItems={workspaceState.shortlist}
            savedLoading={workspaceState.loading}
          />
        </section>
      </div>
    </AppShell>
  );
}

export default Search;
