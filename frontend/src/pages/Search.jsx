import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Tag,
  Typography,
} from "antd";
import {
  ClearOutlined,
  DeleteOutlined,
  FilterOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
  StarOutlined,
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

const presetOptions = [
  { label: "No preset", value: "" },
  { label: "Wonderkids", value: "wonderkids" },
  { label: "Bargains", value: "bargains" },
  { label: "Elite players", value: "elite" },
];

const positionOptions = [
  { label: "Any position", value: "" },
  { label: "Goalkeeper", value: "goalkeeper" },
  { label: "Defender", value: "defender" },
  { label: "Full back / wing back", value: "fullback" },
  { label: "Midfielder", value: "midfielder" },
  { label: "Playmaker", value: "playmaker" },
  { label: "Winger", value: "winger" },
  { label: "Striker", value: "striker" },
];

const valueOptions = [
  { label: "GBP 1m", value: 1000000 },
  { label: "GBP 5m", value: 5000000 },
  { label: "GBP 10m", value: 10000000 },
  { label: "GBP 25m", value: 25000000 },
  { label: "GBP 50m", value: 50000000 },
  { label: "GBP 100m", value: 100000000 },
];

const wageOptions = [
  { label: "GBP 25k / week", value: 25000 },
  { label: "GBP 50k / week", value: 50000 },
  { label: "GBP 100k / week", value: 100000 },
  { label: "GBP 250k / week", value: 250000 },
  { label: "GBP 500k / week", value: 500000 },
];

const sortOptions = [
  { label: "Highest CA", value: "ability_desc" },
  { label: "Highest PA", value: "potential_desc" },
  { label: "Lowest value", value: "value_asc" },
  { label: "Lowest wage", value: "wage_asc" },
  { label: "Youngest", value: "age_asc" },
  { label: "Name A-Z", value: "name_asc" },
];

function formatDateTime(value) {
  if (!value) return "Unknown time";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value) {
  if (!value || value < 0) return "Unknown";

  return new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(value);
}

function buildBrowserParams(values, limit = PLAYER_PAGE_SIZE) {
  return {
    ...values,
    limit,
  };
}

function readDataError(error) {
  const message = error?.message || "Could not load scouting workspace data.";
  if (
    message.includes("player_search_history") ||
    message.includes("row-level security policy")
  ) {
    return "Search history policy needs to be updated in Supabase. Run the latest search history RLS SQL migration.";
  }

  if (
    message.includes("player_shortlist") ||
    message.includes("player_search_history") ||
    message.includes("Could not find the table")
  ) {
    return "Run the Supabase shortlist/history SQL migration before using this workspace.";
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
  const columns = [
    {
      dataIndex: "player_name",
      key: "player",
      title: "Player",
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Text strong>{item.player_name}</Text>
          <Text type="secondary">
            {[item.club, item.position].filter(Boolean).join(" / ") ||
              "Club or position unavailable"}
          </Text>
        </Space>
      ),
    },
    {
      dataIndex: "source",
      key: "source",
      responsive: ["md"],
      title: "Source",
      render: (source) => <Tag color="blue">{source || "Manual"}</Tag>,
    },
    {
      dataIndex: "updated_at",
      key: "updated_at",
      responsive: ["lg"],
      title: "Saved",
      render: formatDateTime,
    },
    {
      key: "actions",
      title: "",
      width: 128,
      render: (_, item) => (
        <Space>
          <Button
            icon={<SearchOutlined />}
            onClick={() => onAnalyze(item.player_name)}
          >
            Open
          </Button>
          <Button
            aria-label={`Remove ${item.player_name} from shortlist`}
            danger
            icon={<DeleteOutlined />}
            onClick={() => onRemove(item.id)}
            title={`Remove ${item.player_name}`}
            type="text"
          />
        </Space>
      ),
    },
  ];

  return (
    <Card
      className="workspace-card"
      title={
        <Space>
          <StarOutlined />
          <span>Shortlist</span>
          <Tag>{items.length}</Tag>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={items}
        locale={{
          emptyText: (
            <Empty
              description="Save players from a scouting report to build your shortlist."
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
  const columns = [
    {
      dataIndex: "query",
      key: "query",
      title: "Search",
      render: (query) => <Text strong>{query}</Text>,
    },
    {
      dataIndex: "result_count",
      key: "result_count",
      responsive: ["md"],
      title: "Results",
      render: (value) => (value === null || value === undefined ? "-" : value),
    },
    {
      dataIndex: "created_at",
      key: "created_at",
      responsive: ["lg"],
      title: "Date",
      render: formatDateTime,
    },
    {
      key: "actions",
      title: "",
      width: 128,
      render: (_, item) => (
        <Space>
          <Button icon={<HistoryOutlined />} onClick={() => onAnalyze(item.query)}>
            Open
          </Button>
          <Button
            aria-label={`Delete ${item.query} from search history`}
            danger
            icon={<DeleteOutlined />}
            onClick={() => onRemove(item.id)}
            title={`Delete ${item.query}`}
            type="text"
          />
        </Space>
      ),
    },
  ];

  return (
    <Card
      className="workspace-card"
      extra={
        items.length > 0 ? (
          <Button danger icon={<ClearOutlined />} onClick={onClear} type="text">
            Clear
          </Button>
        ) : null
      }
      title={
        <Space>
          <HistoryOutlined />
          <span>Search history</span>
          <Tag>{items.length}</Tag>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={items}
        locale={{
          emptyText: (
            <Empty
              description="Searches will appear here after you run a scouting report."
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
  const [browserForm] = Form.useForm();
  const [browserState, setBrowserState] = useState({
    loading: false,
    error: "",
    players: [],
    count: 0,
    limit: PLAYER_PAGE_SIZE,
  });

  useEffect(() => {
    let isActive = true;

    async function loadInitialPlayers() {
      setBrowserState((state) => ({
        ...state,
        loading: true,
        error: "",
      }));

      try {
        const result = await searchPlayers(
          buildBrowserParams(playerBrowserDefaults, PLAYER_PAGE_SIZE)
        );
        if (!isActive) return;
        setBrowserState({
          loading: false,
          error: "",
          players: result.players || [],
          count: result.count || 0,
          limit: PLAYER_PAGE_SIZE,
        });
      } catch (loadError) {
        if (!isActive) return;
        setBrowserState({
          loading: false,
          error:
            loadError?.response?.data?.message ||
            loadError?.message ||
            "Could not load player database.",
          players: [],
          count: 0,
          limit: PLAYER_PAGE_SIZE,
        });
      }
    }

    loadInitialPlayers();

    return () => {
      isActive = false;
    };
  }, []);

  async function applyFilters(values, limit = PLAYER_PAGE_SIZE) {
    setBrowserState((state) => ({
      ...state,
      loading: true,
      error: "",
    }));

    try {
      const result = await searchPlayers(buildBrowserParams(values, limit));
      setBrowserState({
        loading: false,
        error: "",
        players: result.players || [],
        count: result.count || 0,
        limit,
      });
    } catch (filterError) {
      setBrowserState((state) => ({
        ...state,
        loading: false,
        error:
          filterError?.response?.data?.message ||
          filterError?.message ||
          "Could not filter the player database.",
      }));
    }
  }

  function resetFilters() {
    browserForm.resetFields();
    applyFilters(playerBrowserDefaults, PLAYER_PAGE_SIZE);
  }

  function loadMorePlayers() {
    const nextLimit = Math.min(
      browserState.limit + PLAYER_PAGE_SIZE,
      PLAYER_MAX_RESULTS
    );

    applyFilters(browserForm.getFieldsValue(), nextLimit);
  }

  const columns = [
    {
      dataIndex: "name",
      key: "player",
      title: "Player",
      render: (_, player) => (
        <div className="database-player-cell">
          <Text strong>{player.name}</Text>
          <Text type="secondary">
            {[player.club, player.nationality, player.position]
              .filter(Boolean)
              .join(" / ") || "Profile details unavailable"}
          </Text>
        </div>
      ),
    },
    {
      dataIndex: "age",
      key: "age",
      title: "Age",
      width: 80,
      render: (age) => age ?? "-",
    },
    {
      key: "ability",
      title: "CA / PA",
      width: 120,
      render: (_, player) => (
        <Space size={6}>
          <Tag color="blue">{player.currentAbility ?? "-"}</Tag>
          <Tag color="green">{player.potentialAbility ?? "-"}</Tag>
        </Space>
      ),
    },
    {
      dataIndex: "marketValue",
      key: "marketValue",
      responsive: ["md"],
      title: "Value",
      width: 120,
      render: formatMoney,
    },
    {
      dataIndex: "salary",
      key: "salary",
      responsive: ["lg"],
      title: "Wage",
      width: 130,
      render: (value) => (value ? `${formatMoney(value)} / week` : "Unknown"),
    },
    {
      key: "actions",
      title: "",
      width: 122,
      render: (_, player) => (
        <Button
          icon={<SearchOutlined />}
          onClick={() => onAnalyze(player.name)}
          type="primary"
        >
          Analyze
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
      extra={<Tag color="blue">{browserState.count} shown</Tag>}
      title={
        <Space>
          <FilterOutlined />
          <span>Player database</span>
        </Space>
      }
    >
      <div className="player-database-grid">
        <div className="player-filter-sidebar">
          <div className="player-browser-intro">
            <Text type="secondary">
              Filter the player pool, review matching candidates, then open a
              full similarity report for the player you want to scout.
            </Text>
          </div>

          <Form
            form={browserForm}
            initialValues={playerBrowserDefaults}
            layout="vertical"
            onFinish={applyFilters}
            requiredMark={false}
          >
            <div className="player-filter-grid">
              <Form.Item label="Name" name="name">
                <Input
                  allowClear
                  placeholder="e.g. Bellingham"
                  prefix={<SearchOutlined />}
                />
              </Form.Item>

              <Form.Item label="Club" name="club">
                <Input allowClear placeholder="e.g. Dortmund" />
              </Form.Item>

              <Form.Item label="Nationality" name="nationality">
                <Input allowClear placeholder="e.g. England" />
              </Form.Item>

              <Form.Item label="Position" name="position">
                <Select options={positionOptions} />
              </Form.Item>

              <Form.Item label="Preset" name="preset">
                <Select options={presetOptions} />
              </Form.Item>

              <Form.Item label="Min age" name="minAge">
                <InputNumber max={45} min={15} placeholder="18" />
              </Form.Item>

              <Form.Item label="Max age" name="maxAge">
                <InputNumber max={45} min={15} placeholder="24" />
              </Form.Item>

              <Form.Item label="Min CA" name="minCA">
                <InputNumber max={200} min={1} placeholder="130" />
              </Form.Item>

              <Form.Item label="Min PA" name="minPA">
                <InputNumber max={200} min={1} placeholder="150" />
              </Form.Item>

              <Form.Item label="Max value" name="maxValue">
                <Select allowClear options={valueOptions} placeholder="Any budget" />
              </Form.Item>

              <Form.Item label="Max wage" name="maxSalary">
                <Select allowClear options={wageOptions} placeholder="Any wage" />
              </Form.Item>

              <Form.Item label="Sort by" name="sort">
                <Select allowClear options={sortOptions} placeholder="Default order" />
              </Form.Item>
            </div>

            <div className="player-filter-actions">
              <Button htmlType="submit" icon={<FilterOutlined />} type="primary">
                Apply filters
              </Button>
              <Button icon={<ReloadOutlined />} onClick={resetFilters}>
                Reset filters
              </Button>
            </div>
          </Form>
        </div>

        <div className="player-results-area">
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
                  description="No players match those filters."
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            pagination={false}
            rowKey={(player) => player.uid || player.id || player.name}
            scroll={{ x: 780 }}
            size="middle"
          />
          <div className="player-load-more">
            <Button
              disabled={!hasMorePlayers}
              loading={browserState.loading}
              onClick={loadMorePlayers}
            >
              Load more players
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Search() {
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
          error: readDataError(workspaceError),
          shortlist: [],
          history: [],
        });
      });

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  function startAnalysis(name) {
    const cleanedName = String(name || "").trim();
    if (cleanedName.length < 2) {
      setWorkspaceState((state) => ({
        ...state,
        error: "Select a player before opening a scouting report.",
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
      setWorkspaceState((state) => ({
        ...state,
        shortlist: state.shortlist.filter((item) => item.id !== id),
      }));
    } catch (removeError) {
      setWorkspaceState((state) => ({
        ...state,
        error: readDataError(removeError),
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
        error: readDataError(removeError),
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
        error: readDataError(clearError),
      }));
    }
  }

  return (
    <AppShell>
      <section className="page-intro">
        <div>
          <span className="section-kicker">Scouting workspace</span>
          <h1 className="page-title search-page-title">
            Manage your shortlist and scout the next player.
          </h1>
          <p className="page-subtitle">
            Use the player database to filter candidates and open a full
            report. Saved players and search history stay in your workspace.
          </p>
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
          <Card>
            <Spin />
            <Text style={{ marginLeft: 12 }} type="secondary">
              Loading scouting workspace
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
    </AppShell>
  );
}

export default Search;
