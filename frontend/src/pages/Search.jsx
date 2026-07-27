import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Table,
  Typography,
} from "antd";
import {
  ArrowRightOutlined,
  ClearOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FilterOutlined,
  HistoryOutlined,
  LoadingOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  SearchOutlined,
  StarOutlined,
  TeamOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";
import {
  clearSearchHistory,
  loadSearchHistory,
  loadShortlist,
  removeSearchHistoryItem,
  removeShortlistItem,
} from "../services/scoutingData";
import { searchPlayers } from "../services/api";

const { Text } = Typography;

const LAST_PLAYER_RESULT_STORAGE_KEY = "scoutai.lastPlayerResult";
const PLAYER_SESSION_CHANGE_EVENT = "scoutai-player-session-change";
const PLAYER_PAGE_SIZE = 13;
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

function formatDateTime(value, t, language) {
  if (!value) return t("players.unknownTime");

  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value, t) {
  if (!value || value < 0) return t("players.unknown");

  return new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(value);
}

function getPlayerInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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

function ShortlistPanel({ items, onAnalyze, onRemove }) {
  const { i18n, t } = useTranslation("search");
  const columns = [
    {
      dataIndex: "player_name",
      key: "player",
      title: t("players.player"),
      render: (_, item) => (
        <div className="workspace-player">
          <span className="workspace-row-avatar" aria-hidden="true">
            {getPlayerInitials(item.player_name)}
          </span>
          <span className="workspace-player-copy">
            <Text strong>{item.player_name}</Text>
            <Text type="secondary">
              {[item.club, item.position].filter(Boolean).join(" / ") ||
                t("players.positionUnavailable")}
            </Text>
          </span>
        </div>
      ),
    },
    {
      dataIndex: "source",
      key: "source",
      responsive: ["md"],
      title: t("players.source"),
      render: (source) => (
        <span className="workspace-source-pill">
          {source || t("players.manual")}
        </span>
      ),
    },
    {
      dataIndex: "updated_at",
      key: "updated_at",
      responsive: ["lg"],
      title: t("shortlist.saved"),
      render: (value) => (
        <span className="workspace-date">
          {formatDateTime(value, t, i18n.language)}
        </span>
      ),
    },
    {
      key: "actions",
      title: "",
      width: 128,
      render: (_, item) => (
        <Space>
          <Button
            className="workspace-open-button"
            icon={<SearchOutlined />}
            onClick={() => onAnalyze(item.player_name)}
          >
            {t("actions.open")}
          </Button>
          <Button
            aria-label={t("shortlist.removeAria", {
              name: item.player_name,
            })}
            className="workspace-remove-button"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onRemove(item.id)}
            title={t("shortlist.removeAria", {
              name: item.player_name,
            })}
            type="text"
          />
        </Space>
      ),
    },
  ];

  return (
    <Card
      className="workspace-card shortlist-card"
      title={
        <div className="workspace-card-heading">
          <span className="workspace-card-icon">
            <StarOutlined />
          </span>
          <span className="workspace-card-title">
            <strong>{t("shortlist.title")}</strong>
            <small>{t("shortlist.subtitle")}</small>
          </span>
          <span className="workspace-card-count">{items.length}</span>
        </div>
      }
    >
      <Table
        columns={columns}
        dataSource={items}
        locale={{
          emptyText: (
            <Empty
              description={t("shortlist.empty")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        pagination={items.length > 5 ? { pageSize: 5 } : false}
        rowKey="id"
        scroll={{ x: 560 }}
        size="middle"
      />
    </Card>
  );
}

function HistoryPanel({ items, onAnalyze, onClear, onRemove }) {
  const { i18n, t } = useTranslation("search");
  const columns = [
    {
      dataIndex: "query",
      key: "query",
      title: t("history.search"),
      render: (query) => (
        <div className="workspace-player">
          <span className="workspace-row-avatar is-history" aria-hidden="true">
            {getPlayerInitials(query)}
          </span>
          <span className="workspace-player-copy">
            <Text strong>{query}</Text>
            <Text type="secondary">{t("history.playerReport")}</Text>
          </span>
        </div>
      ),
    },
    {
      dataIndex: "result_count",
      key: "result_count",
      responsive: ["md"],
      title: t("history.results"),
      render: (value) => (
        <span className="workspace-result-pill">
          {value === null || value === undefined ? "-" : value}
        </span>
      ),
    },
    {
      dataIndex: "created_at",
      key: "created_at",
      responsive: ["lg"],
      title: t("history.date"),
      render: (value) => (
        <span className="workspace-date">
          {formatDateTime(value, t, i18n.language)}
        </span>
      ),
    },
    {
      key: "actions",
      title: "",
      width: 128,
      render: (_, item) => (
        <Space>
          <Button
            className="workspace-open-button"
            icon={<HistoryOutlined />}
            onClick={() => onAnalyze(item.query)}
          >
            {t("actions.open")}
          </Button>
          <Button
            aria-label={t("history.deleteAria", { name: item.query })}
            className="workspace-remove-button"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onRemove(item.id)}
            title={t("history.deleteAria", { name: item.query })}
            type="text"
          />
        </Space>
      ),
    },
  ];

  return (
    <Card
      className="workspace-card history-card"
      extra={
        items.length > 0 ? (
          <Button danger icon={<ClearOutlined />} onClick={onClear} type="text">
            {t("actions.clear")}
          </Button>
        ) : null
      }
      title={
        <div className="workspace-card-heading">
          <span className="workspace-card-icon">
            <HistoryOutlined />
          </span>
          <span className="workspace-card-title">
            <strong>{t("history.title")}</strong>
            <small>{t("history.subtitle")}</small>
          </span>
          <span className="workspace-card-count">{items.length}</span>
        </div>
      }
    >
      <Table
        columns={columns}
        dataSource={items}
        locale={{
          emptyText: (
            <Empty
              description={t("history.empty")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        pagination={items.length > 5 ? { pageSize: 5 } : false}
        rowKey="id"
        scroll={{ x: 560 }}
        size="middle"
      />
    </Card>
  );
}

function PlayerDatabasePanel({ onAnalyze }) {
  const { t } = useTranslation("search");
  const [browserForm] = Form.useForm();
  const browserRequestController = useRef(null);
  const browserRequestId = useRef(0);
  const [nameSearch, setNameSearch] = useState("");
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [filterFeedback, setFilterFeedback] = useState({
    status: "",
    text: "",
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

  const columns = [
    {
      dataIndex: "name",
      key: "player",
      title: t("players.player"),
      render: (_, player) => (
        <div className="database-player">
          <span className="database-player-avatar" aria-hidden="true">
            {getPlayerInitials(player.name)}
          </span>
          <div className="database-player-cell">
            <Text strong>{player.name}</Text>
            <Text type="secondary">
              {[player.club, player.nationality, player.position]
                .filter(Boolean)
                .join(" / ") || t("players.profileUnavailable")}
            </Text>
          </div>
        </div>
      ),
    },
    {
      dataIndex: "age",
      key: "age",
      title: t("players.age"),
      width: 80,
      render: (age) => age ?? "-",
    },
    {
      key: "ability",
      title: "CA / PA",
      width: 120,
      render: (_, player) => (
        <div className="ability-pair">
          <span className="ability-pill is-current">
            {player.currentAbility ?? "-"}
          </span>
          <ArrowRightOutlined aria-hidden="true" />
          <span className="ability-pill is-potential">
            {player.potentialAbility ?? "-"}
          </span>
        </div>
      ),
    },
    {
      dataIndex: "marketValue",
      key: "marketValue",
      responsive: ["md"],
      title: t("players.value"),
      width: 120,
      render: (value) => formatMoney(value, t),
    },
    {
      dataIndex: "salary",
      key: "salary",
      responsive: ["lg"],
      title: t("players.wage"),
      width: 130,
      render: (value) =>
        value
          ? t("players.wagePerWeek", { value: formatMoney(value, t) })
          : t("players.unknown"),
    },
    {
      key: "actions",
      title: "",
      width: 122,
      render: (_, player) => (
        <Button
          className="analyze-player-button"
          icon={<RadarChartOutlined />}
          onClick={() => onAnalyze(player.name)}
        >
          {t("actions.analyze")}
        </Button>
      ),
    },
  ];
  const hasMorePlayers =
    browserState.players.length >= browserState.limit &&
    browserState.limit < PLAYER_MAX_RESULTS;

  return (
    <Card
      className="player-browser-card"
      extra={
        <span className="database-result-count">
          <strong>{browserState.count}</strong> {t("database.shown")}
        </span>
      }
      title={
        <div className="database-card-header">
          <div className="database-card-heading">
            <span className="database-card-icon">
              <DatabaseOutlined />
            </span>
            <span>
              <strong>{t("database.title")}</strong>
              <small>{t("database.description")}</small>
            </span>
          </div>
          <div className="database-name-search" role="search">
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
            <Button
              aria-label={t("database.searchAria")}
              className="database-name-search-button"
              icon={<SearchOutlined />}
              loading={browserState.loading}
              onClick={() => searchByName(nameSearch)}
              shape="circle"
            />
          </div>
        </div>
      }
    >
      <div className="player-database-grid">
        <div className="player-filter-sidebar">
          <div className="player-filter-sidebar-heading">
            <span>
              <FilterOutlined />
              {t("filters.title")}
            </span>
            <small>{t("filters.count")}</small>
          </div>
          <div className="player-browser-intro">
            <Text type="secondary">
              {t("filters.description")}
            </Text>
          </div>

          <Form
            form={browserForm}
            initialValues={playerBrowserDefaults}
            layout="vertical"
            onFinish={(values) =>
              applyFilters(
                {
                  ...values,
                  name: nameSearch,
                },
                PLAYER_PAGE_SIZE,
                t("feedback.filtersApplied")
              )
            }
            requiredMark={false}
          >
            <div className="player-filter-scroll">
              <div className="player-filter-grid">
                <Form.Item label={t("filters.club")} name="club">
                  <Input
                    allowClear
                    placeholder={t("filters.clubPlaceholder")}
                  />
                </Form.Item>

                <Form.Item label={t("filters.nationality")} name="nationality">
                  <Input
                    allowClear
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
        </div>

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

          <Table
            columns={columns}
            dataSource={browserState.players}
            loading={browserState.loading}
            locale={{
              emptyText: (
                <Empty
                  description={t("database.noMatches")}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            pagination={false}
            rowKey={(player) => player.uid || player.id || player.name}
            scroll={{ x: 780, y: 470 }}
            size="middle"
          />
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
    </Card>
  );
}

function Search() {
  const { t } = useTranslation("search");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workspaceState, setWorkspaceState] = useState({
    loading: true,
    error: "",
    shortlist: [],
    history: [],
  });

  useEffect(() => {
    let isActive = true;

    if (!user?.id) {
      setWorkspaceState({
        loading: false,
        error: "",
        shortlist: [],
        history: [],
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

    Promise.all([loadShortlist(user.id), loadSearchHistory(user.id)])
      .then(([shortlist, history]) => {
        if (!isActive) return;
        setWorkspaceState({
          loading: false,
          error: "",
          shortlist,
          history,
        });
      })
      .catch((workspaceError) => {
        if (!isActive) return;
        setWorkspaceState({
          loading: false,
          error: readDataError(workspaceError, t),
          shortlist: [],
          history: [],
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

  async function removeHistory(id) {
    if (!user?.id) return;

    try {
      await removeSearchHistoryItem(user.id, id);
      setWorkspaceState((state) => ({
        ...state,
        history: state.history.filter((item) => item.id !== id),
      }));
    } catch (removeError) {
      setWorkspaceState((state) => ({
        ...state,
        error: readDataError(removeError, t),
      }));
    }
  }

  async function clearHistory() {
    if (!user?.id) return;

    try {
      await clearSearchHistory(user.id);
      setWorkspaceState((state) => ({
        ...state,
        history: [],
      }));
    } catch (clearError) {
      setWorkspaceState((state) => ({
        ...state,
        error: readDataError(clearError, t),
      }));
    }
  }

  return (
    <AppShell>
      <div className="search-workspace">
        <section className="page-intro search-hero">
          <div className="search-hero-copy">
            <span className="search-hero-badge">
              <i />
              {t("hero.badge")}
            </span>
            <span className="section-kicker">{t("hero.kicker")}</span>
            <h1 className="page-title search-page-title">
              {t("hero.title")}
            </h1>
            <p className="page-subtitle">{t("hero.description")}</p>
          </div>

          <div
            className="search-hero-summary"
            aria-label={t("hero.summary")}
          >
            <div className="search-summary-item">
              <span className="search-summary-icon">
                <TeamOutlined />
              </span>
              <span>
                <strong>8,452</strong>
                <small>{t("shortlist.playerProfiles")}</small>
              </span>
            </div>
            <div className="search-summary-item">
              <span className="search-summary-icon">
                <StarOutlined />
              </span>
              <span>
                <strong>
                  {workspaceState.loading ? "-" : workspaceState.shortlist.length}
                </strong>
                <small>{t("shortlist.savedPlayers")}</small>
              </span>
            </div>
            <div className="search-summary-item">
              <span className="search-summary-icon">
                <HistoryOutlined />
              </span>
              <span>
                <strong>
                  {workspaceState.loading ? "-" : workspaceState.history.length}
                </strong>
                <small>{t("history.recentSearches")}</small>
              </span>
            </div>
          </div>
        </section>

        {workspaceState.error && (
          <Alert
            message={workspaceState.error}
            showIcon
            style={{ marginBottom: 16 }}
            type="warning"
          />
        )}

        <section className="database-section">
          <PlayerDatabasePanel onAnalyze={startAnalysis} />
        </section>

        <section className="report-section" id="workspace">
          {workspaceState.loading ? (
            <Card className="workspace-loading-card">
              <Spin />
              <Text style={{ marginLeft: 12 }} type="secondary">
                {t("hero.loading")}
              </Text>
            </Card>
          ) : (
            <div className="workspace-stack">
              <ShortlistPanel
                items={workspaceState.shortlist}
                onAnalyze={startAnalysis}
                onRemove={removeShortlist}
              />
              <HistoryPanel
                items={workspaceState.history}
                onAnalyze={startAnalysis}
                onClear={clearHistory}
                onRemove={removeHistory}
              />
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default Search;
