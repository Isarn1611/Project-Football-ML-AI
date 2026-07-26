import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  List,
  Progress,
  Result as AntResult,
  Row,
  Skeleton,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  BulbOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from "@ant-design/icons";

import {
  clearAiAnalysisCache,
  clearRecommendationCache,
  getAiAnalysis,
  getRecommendations,
} from "../services/api";
import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";
import {
  getPlayerKey,
  loadShortlist,
  recordSearch,
  removeShortlistPlayer,
  upsertShortlistPlayer,
} from "../services/scoutingData";

const { Paragraph, Text, Title } = Typography;

const compactCurrencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  maximumFractionDigits: 1,
});

const modelStyles = [
  {
    badge: "Clone finder",
    color: "#1677ff",
    description: "Closest overall attribute profile",
    tag: "blue",
  },
  {
    badge: "Style match",
    color: "#13c2c2",
    description: "Nearest technical and role similarity",
    tag: "cyan",
  },
  {
    badge: "Strict radius",
    color: "#722ed1",
    description: "Only players inside a tighter match range",
    tag: "purple",
  },
  {
    badge: "Tactical group",
    color: "#faad14",
    description: "Players from the same statistical cluster",
    tag: "gold",
  },
  {
    badge: "Outlier check",
    color: "#f5222d",
    description: "Flags candidates that sit outside the normal pattern",
    tag: "red",
  },
];

const attributeGroupStyles = {
  Technical: { color: "#1677ff", tag: "blue" },
  Mental: { color: "#13c2c2", tag: "cyan" },
  Physical: { color: "#faad14", tag: "gold" },
  Goalkeeping: { color: "#722ed1", tag: "purple" },
};

const physicalRadarLabels = {
  Acceleration: "Accel.",
  "Jumping Reach": "Jump Reach",
  "Natural Fitness": "Fitness",
};

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function formatCompactCurrency(value) {
  const numericValue = Number(value);

  return value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(numericValue)
    ? "-"
    : compactCurrencyFormatter.format(numericValue);
}

function normalizeScore(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 0;
  return Math.max(0, Math.min(100, numericScore));
}

function normalizeAttribute(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(20, numericValue));
}

function getVisibleAttributeGroups(attributes, position) {
  const isGoalkeeper = String(position || "")
    .toUpperCase()
    .startsWith("GK");

  return Object.entries(attributes || {}).filter(
    ([groupName, values]) =>
      Object.keys(values || {}).length > 0 &&
      (groupName !== "Goalkeeping" || isGoalkeeper)
  );
}

function readApiError(error) {
  const payload = error.response?.data;
  return {
    status: error.response?.status,
    code: payload?.code || "REQUEST_FAILED",
    message:
      payload?.message ||
      "Could not complete the scouting analysis. Make sure the app services are running, then try again.",
    matches: payload?.details?.matches || [],
  };
}

function readAiApiError(error) {
  const payload = error.response?.data;
  return {
    code: payload?.code || "AI_REQUEST_FAILED",
    message:
      payload?.message ||
      "Could not generate the AI analysis. Check the AI setup and try again.",
  };
}

function readShortlistError(error) {
  const message = error?.message || "Could not update shortlist.";
  if (
    message.includes("player_search_history") ||
    message.includes("row-level security policy")
  ) {
    return "Search history policy needs to be updated in Supabase. Run the latest search history RLS SQL migration.";
  }

  if (
    message.includes("player_shortlist") ||
    message.includes("Could not find the table")
  ) {
    return "Run the Supabase shortlist/history SQL migration before using shortlist.";
  }

  return message;
}

function countModelResults(results) {
  return Object.values(results || {}).reduce(
    (total, players) => total + (Array.isArray(players) ? players.length : 0),
    0
  );
}

function getPlayerPosition(player) {
  return player?.FullPosition || player?.Position || player?.position;
}

function getPlayerCa(player) {
  return player?.CurrentAbility ?? player?.CA ?? player?.ca;
}

function getPlayerPa(player) {
  return player?.PotentialAbility ?? player?.PA ?? player?.pa;
}

function getPlayerSummary(player) {
  return [player?.Club, getPlayerPosition(player)].filter(Boolean).join(" / ");
}

function ShortlistButton({ disabled, isSaved, onClick, size = "middle" }) {
  return (
    <Button
      disabled={disabled}
      icon={isSaved ? <StarFilled /> : <StarOutlined />}
      onClick={onClick}
      size={size}
      type={isSaved ? "default" : "primary"}
    >
      {isSaved ? "Saved" : "Save"}
    </Button>
  );
}

function ReportMetric({ detail, label, value }) {
  return (
    <Card className="report-metric-card" size="small">
      <Text className="report-metric-label">{label}</Text>
      <div className="report-metric-value">{value}</div>
      {detail && (
        <Text className="report-metric-detail" type="secondary">
          {detail}
        </Text>
      )}
    </Card>
  );
}

function ReportBreadcrumb({ playerName }) {
  return (
    <Breadcrumb
      className="report-breadcrumb"
      items={[
        {
          title: <Link to="/">Search</Link>,
        },
        {
          title: <span>{playerName}</span>,
        },
      ]}
      separator="/"
    />
  );
}

function LoadingState({ playerName }) {
  return (
    <div aria-live="polite" className="state-center">
      <Space align="center" direction="vertical" size={16}>
        <Spin size="large" />
        <div>
          <span className="section-kicker">Five engines running</span>
          <Title level={2} style={{ margin: "8px 0 0" }}>
            Analyzing {playerName}
          </Title>
          <Paragraph type="secondary">
            Comparing weighted attributes across the player dataset.
          </Paragraph>
        </div>
      </Space>
    </div>
  );
}

function ErrorState({ error, onRetry, onSelectPlayer }) {
  const matches = Array.isArray(error.matches) ? error.matches : [];
  const hasMatches = matches.length > 0;

  return (
    <Card>
      <AntResult
        status={hasMatches ? "warning" : "error"}
        title={hasMatches ? "That name matches more than one player." : error.message}
        subTitle={hasMatches ? "Choose the exact player to continue." : undefined}
        extra={
          error.code === "MISSING_PLAYER" ? (
            <Link className="app-nav-button" to="/">
              <ArrowLeftOutlined />
              Choose a player
            </Link>
          ) : !hasMatches ? (
            <Button icon={<ReloadOutlined />} onClick={onRetry} type="primary">
              Try again
            </Button>
          ) : null
        }
      />

      {hasMatches && (
        <List
          bordered
          dataSource={matches}
          renderItem={(match) => (
            <List.Item
              actions={[
                <Button
                  icon={<SearchOutlined />}
                  key="select"
                  onClick={() => onSelectPlayer(match.Name)}
                  type="primary"
                >
                  Analyze
                </Button>,
              ]}
            >
              <List.Item.Meta
                description={formatValue(match.Club)}
                title={<Text strong>{match.Name}</Text>}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

function AttributeGroupCard({ groupName, attributes }) {
  const style = attributeGroupStyles[groupName] || attributeGroupStyles.Technical;

  return (
    <Card
      className="attribute-card"
      size="small"
      title={
        <Space>
          <Tag color={style.tag}>{groupName}</Tag>
          <Text type="secondary">1-20</Text>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {Object.entries(attributes).map(([attributeName, value]) => {
          const normalizedValue = normalizeAttribute(value);

          return (
            <div className="attribute-row" key={attributeName}>
              <div className="attribute-line">
                <Text ellipsis type="secondary">
                  {attributeName}
                </Text>
                <Text strong>{formatValue(value)}</Text>
              </div>
              <Progress
                percent={(normalizedValue / 20) * 100}
                showInfo={false}
                size="small"
                strokeColor={style.color}
              />
            </div>
          );
        })}
      </Space>
    </Card>
  );
}

function getRadarPoint(index, total, radius, center) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;

  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function getRadarPointString(items, radius, center, valueScale = () => 1) {
  return items
    .map((item, index) => {
      const point = getRadarPoint(
        index,
        items.length,
        radius * valueScale(item),
        center
      );

      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    })
    .join(" ");
}

function getRadarLabel(attributeName) {
  const label = physicalRadarLabels[attributeName] || attributeName;
  return label.length > 12 ? `${label.slice(0, 11)}.` : label;
}

function PhysicalRadarCard({ attributes }) {
  const items = Object.entries(attributes || {}).map(([name, value]) => ({
    label: getRadarLabel(name),
    name,
    value: normalizeAttribute(value),
  }));

  if (items.length < 3) return null;

  const center = 120;
  const radius = 74;
  const labelRadius = 99;
  const levels = [0.25, 0.5, 0.75, 1];
  const average = Math.round(
    items.reduce((total, item) => total + item.value, 0) / items.length
  );
  const dataPoints = getRadarPointString(
    items,
    radius,
    center,
    (item) => item.value / 20
  );

  return (
    <Card
      className="physical-radar-card"
      size="small"
      title={
        <Space>
          <Tag color="gold">Physical radar</Tag>
          <Text type="secondary">1-20</Text>
        </Space>
      }
    >
      <svg
        aria-label="Physical attributes radar chart"
        className="radar-chart"
        role="img"
        viewBox="0 0 240 240"
      >
        {levels.map((level) => (
          <polygon
            className="radar-grid"
            key={level}
            points={getRadarPointString(items, radius * level, center)}
          />
        ))}

        {items.map((item, index) => {
          const axisPoint = getRadarPoint(index, items.length, radius, center);
          const labelPoint = getRadarPoint(
            index,
            items.length,
            labelRadius,
            center
          );
          const horizontalOffset = labelPoint.x - center;

          return (
            <g key={item.name}>
              <line
                className="radar-axis"
                x1={center}
                x2={axisPoint.x}
                y1={center}
                y2={axisPoint.y}
              />
              <text
                className="radar-label"
                dominantBaseline="middle"
                textAnchor={
                  horizontalOffset > 12
                    ? "start"
                    : horizontalOffset < -12
                      ? "end"
                      : "middle"
                }
                x={labelPoint.x}
                y={labelPoint.y}
              >
                {item.label}
              </text>
            </g>
          );
        })}

        <polygon className="radar-area" points={dataPoints} />
        {items.map((item, index) => {
          const point = getRadarPoint(
            index,
            items.length,
            radius * (item.value / 20),
            center
          );

          return (
            <circle
              className="radar-point"
              cx={point.x}
              cy={point.y}
              key={item.name}
              r="3.5"
            />
          );
        })}

        <text className="radar-score-value" x={center} y={center - 3}>
          {average}
        </text>
        <text className="radar-score-label" x={center} y={center + 15}>
          avg
        </text>
      </svg>
    </Card>
  );
}

function TargetAttributes({ target }) {
  const groups = getVisibleAttributeGroups(
    target.Attributes,
    target.FullPosition || target.Position
  );

  if (groups.length === 0) return null;

  return (
    <section className="attribute-section">
      <div className="attribute-heading">
        <div>
          <span className="section-kicker">Player profile</span>
          <Title level={3} style={{ margin: "4px 0 0" }}>
            Attribute overview
          </Title>
        </div>
        <div className="attribute-tags">
          <Tag>{formatValue(target.Nationality)}</Tag>
          <Tag>{formatValue(target.Height)} cm</Tag>
          <Tag>{formatValue(target.Weight)} kg</Tag>
          <Tag>Left foot {formatValue(target.LeftFoot)}</Tag>
          <Tag>Right foot {formatValue(target.RightFoot)}</Tag>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        {groups.map(([groupName, attributes]) => (
          <Col key={groupName} lg={groups.length === 4 ? 6 : 8} md={12} xs={24}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <AttributeGroupCard attributes={attributes} groupName={groupName} />
              {groupName === "Physical" && (
                <PhysicalRadarCard attributes={attributes} />
              )}
            </Space>
          </Col>
        ))}
      </Row>
    </section>
  );
}

function CandidateAttributeDetails({ player }) {
  const groups = getVisibleAttributeGroups(player.Attributes, player.Position);

  if (groups.length === 0) {
    return (
      <Empty
        description="No attribute snapshot available."
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div className="candidate-detail-grid">
      {groups.map(([groupName, attributes]) => {
        const style =
          attributeGroupStyles[groupName] || attributeGroupStyles.Technical;

        return (
          <div key={groupName}>
            <div className="candidate-detail-title" style={{ color: style.color }}>
              {groupName}
            </div>
            {Object.entries(attributes).map(([attributeName, value]) => (
              <div className="detail-attribute" key={attributeName}>
                <Text ellipsis type="secondary">
                  {attributeName}
                </Text>
                <Text strong>{formatValue(value)}</Text>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function InsightList({ items, title }) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <List
      bordered
      dataSource={safeItems}
      header={<Text strong>{title}</Text>}
      locale={{ emptyText: "No evidence available." }}
      renderItem={(item) => <List.Item>{item}</List.Item>}
      size="small"
    />
  );
}

function AiAnalysisResult({
  result,
  shortlistActionKey,
  shortlistKeys,
  onToggleShortlist,
}) {
  const analysis = result.analysis || {};
  const targetProfile = analysis.targetProfile || {};
  const recommendations = Array.isArray(analysis.recommendations)
    ? analysis.recommendations
    : [];
  const bestChoices = analysis.bestChoices || {};
  const totalTokens = result.usage?.totalTokens;

  return (
    <Space direction="vertical" size={18} style={{ width: "100%" }}>
      <Space wrap>
        <Tag color="cyan">
          {result.provider} / {result.model}
        </Tag>
        <Tag>Dataset evidence</Tag>
        {totalTokens !== null && totalTokens !== undefined && (
          <Tag>{totalTokens.toLocaleString()} tokens</Tag>
        )}
      </Space>

      <div>
        <Title level={3} style={{ margin: 0 }}>
          {analysis.title}
        </Title>
        <Paragraph style={{ marginTop: 8 }}>{analysis.executiveSummary}</Paragraph>
      </div>

      <Alert
        description={targetProfile.playStyle}
        message="Target play style"
        showIcon
        type="info"
      />

      <Row gutter={[16, 16]}>
        <Col lg={8} xs={24}>
          <InsightList items={targetProfile.strengths} title="Strengths" />
        </Col>
        <Col lg={8} xs={24}>
          <InsightList items={targetProfile.weaknesses} title="Weaknesses" />
        </Col>
        <Col lg={8} xs={24}>
          <InsightList items={targetProfile.risks} title="Risks" />
        </Col>
      </Row>

      <div>
        <Title level={4}>Suggested shortlist</Title>
        <List
          grid={{ gutter: 16, lg: 2, md: 2, sm: 1, xs: 1 }}
          dataSource={recommendations}
          locale={{ emptyText: "No AI recommendations available." }}
          renderItem={(recommendation, index) => {
            const recommendationPlayer = {
              Name: recommendation.playerName,
              sourceRecommendation: recommendation,
            };
            const playerKey = getPlayerKey(recommendationPlayer);
            const isSaved = shortlistKeys.has(playerKey);

            return (
              <List.Item>
                <div className="ai-recommendation">
                  <Space
                    align="start"
                    style={{ justifyContent: "space-between", width: "100%" }}
                  >
                    <Space align="start">
                      <Tag color="cyan">{index + 1}</Tag>
                      <div>
                        <Text strong>{recommendation.playerName}</Text>
                        <Paragraph style={{ marginTop: 6 }}>
                          {recommendation.fitSummary}
                        </Paragraph>
                      </div>
                    </Space>
                    <ShortlistButton
                      disabled={shortlistActionKey === playerKey}
                      isSaved={isSaved}
                      onClick={() =>
                        onToggleShortlist(recommendationPlayer, "AI shortlist")
                      }
                      size="small"
                    />
                  </Space>

                  <Row gutter={[16, 8]}>
                    <Col sm={12} xs={24}>
                      <Text strong>Why it fits</Text>
                      <ul className="plain-list">
                        {(recommendation.reasons || []).map((reason, reasonIndex) => (
                          <li key={`${recommendation.playerName}-reason-${reasonIndex}`}>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </Col>
                    <Col sm={12} xs={24}>
                      <Text strong>Watch points</Text>
                      {(recommendation.concerns || []).length === 0 ? (
                        <Paragraph style={{ marginTop: 8 }} type="secondary">
                          No major concern identified.
                        </Paragraph>
                      ) : (
                        <ul className="plain-list">
                          {recommendation.concerns.map((concern, concernIndex) => (
                            <li
                              key={`${recommendation.playerName}-concern-${concernIndex}`}
                            >
                              {concern}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Col>
                  </Row>
                </div>
              </List.Item>
            );
          }}
        />
      </div>

      <Descriptions bordered column={{ lg: 4, md: 2, xs: 1 }} size="small">
        <Descriptions.Item label="Best overall">
          {formatValue(bestChoices.overall)}
        </Descriptions.Item>
        <Descriptions.Item label="Closest style">
          {formatValue(bestChoices.styleMatch)}
        </Descriptions.Item>
        <Descriptions.Item label="Best value">
          {formatValue(bestChoices.value)}
        </Descriptions.Item>
        <Descriptions.Item label="Best potential">
          {formatValue(bestChoices.potential)}
        </Descriptions.Item>
      </Descriptions>

      {analysis.confidenceNote && (
        <Paragraph type="secondary">{analysis.confidenceNote}</Paragraph>
      )}
    </Space>
  );
}

function AiAnalysisPanel({
  aiState,
  shortlistActionKey,
  shortlistKeys,
  onGenerate,
  onRetry,
  onToggleShortlist,
}) {
  return (
    <Card
      className="report-section"
      extra={
        aiState.status === "idle" ? (
          <Button icon={<RobotOutlined />} onClick={onGenerate} type="primary">
            Generate brief
          </Button>
        ) : null
      }
      title={
        <Space>
          <BulbOutlined />
          <span>AI scouting analysis</span>
        </Space>
      }
    >
      {aiState.status === "idle" && (
        <Paragraph type="secondary">
          Create a short scouting brief from the player data in this report.
        </Paragraph>
      )}

      {aiState.status === "loading" && (
        <Skeleton active paragraph={{ rows: 5 }} title />
      )}

      {aiState.status === "error" && (
        <Alert
          action={
            <Button icon={<ReloadOutlined />} onClick={onRetry} size="small">
              Try again
            </Button>
          }
          description={aiState.error.message}
          message="AI analysis unavailable"
          showIcon
          type="error"
        />
      )}

      {aiState.status === "success" && aiState.result && (
        <AiAnalysisResult
          result={aiState.result}
          shortlistActionKey={shortlistActionKey}
          shortlistKeys={shortlistKeys}
          onToggleShortlist={onToggleShortlist}
        />
      )}
    </Card>
  );
}

function ModelTable({
  modelBadge,
  modelDescription,
  modelName,
  players,
  shortlistActionKey,
  shortlistKeys,
  style,
  onToggleShortlist,
}) {
  const columns = [
    {
      align: "center",
      key: "rank",
      title: "#",
      width: 56,
      render: (_, __, index) => <Tag>{index + 1}</Tag>,
    },
    {
      className: "model-player-column",
      dataIndex: "Name",
      key: "name",
      title: "Player",
      render: (name, player) => {
        const isOutlier = String(name).includes("OUTLIER");
        return (
          <div className="model-player-cell">
            <Text strong type={isOutlier ? "danger" : undefined}>
              {name}
            </Text>
            <Text type="secondary">
              {getPlayerSummary(player) || "Club unavailable"}
            </Text>
          </div>
        );
      },
    },
    {
      dataIndex: "Score",
      key: "score",
      title: "Similarity",
      width: 220,
      render: (score) => {
        const normalizedScore = normalizeScore(score);
        return (
          <div className="model-score-cell">
            <Progress
              percent={normalizedScore}
              showInfo={false}
              size="small"
              strokeColor={style.color}
            />
            <Text strong>{normalizedScore.toFixed(1)}%</Text>
          </div>
        );
      },
    },
    {
      align: "center",
      dataIndex: "Age",
      key: "age",
      responsive: ["md"],
      title: "Age",
      width: 80,
      render: formatValue,
    },
    {
      align: "center",
      key: "ability",
      responsive: ["lg"],
      title: "CA / PA",
      width: 110,
      render: (_, player) => `${formatValue(getPlayerCa(player))} / ${formatValue(getPlayerPa(player))}`,
    },
    {
      align: "right",
      dataIndex: "MarketValue",
      key: "marketValue",
      responsive: ["lg"],
      title: "Value",
      width: 110,
      render: formatCompactCurrency,
    },
    {
      align: "right",
      key: "actions",
      title: "",
      width: 120,
      render: (_, player) => {
        const isOutlier = String(player.Name).includes("OUTLIER");
        const playerKey = getPlayerKey(player);
        const isSaved = shortlistKeys.has(playerKey);

        if (isOutlier) return null;

        return (
          <ShortlistButton
            disabled={shortlistActionKey === playerKey}
            isSaved={isSaved}
            onClick={() => onToggleShortlist(player, `${modelName} candidate`)}
            size="small"
          />
        );
      },
    },
  ];

  return (
    <div className="model-table-panel">
      <div className="model-table-intro">
        <div>
          <Text strong>{modelBadge}</Text>
          <Text type="secondary">{modelDescription}</Text>
        </div>
        <Tag>{players.length} candidates</Tag>
      </div>

      <Table
        className="model-table"
        columns={columns}
        dataSource={players}
        expandable={{
          expandedRowRender: (player) => <CandidateAttributeDetails player={player} />,
          rowExpandable: (player) =>
            !String(player.Name).includes("OUTLIER") &&
            getVisibleAttributeGroups(player.Attributes, player.Position).length > 0,
        }}
        locale={{
          emptyText: (
            <Empty
              description="No player passed this model's matching criteria."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        pagination={players.length > 8 ? { pageSize: 8 } : false}
        rowKey={(player, index) => `${modelName}-${player.Name}-${index}`}
        scroll={{ x: 860 }}
      />
    </div>
  );
}

function Result() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const recordedHistoryKeys = useRef(new Set());
  const playerName = searchParams.get("player")?.trim() || "";
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${playerName}:${reloadToken}`;
  const [requestState, setRequestState] = useState({
    key: "",
    status: "idle",
    result: null,
    error: null,
  });
  const aiRequestKey = playerName.toLocaleLowerCase();
  const [aiState, setAiState] = useState({
    key: "",
    status: "idle",
    result: null,
    error: null,
  });
  const [shortlistState, setShortlistState] = useState({
    actionKey: "",
    error: "",
    items: [],
    loading: true,
  });

  useEffect(() => {
    let isActive = true;

    if (!playerName) {
      return () => {
        isActive = false;
      };
    }

    getRecommendations(playerName)
      .then((data) => {
        if (isActive) {
          setRequestState({
            key: requestKey,
            status: "success",
            result: data,
            error: null,
          });
        }
      })
      .catch((requestError) => {
        if (isActive) {
          setRequestState({
            key: requestKey,
            status: "error",
            result: null,
            error: readApiError(requestError),
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [playerName, requestKey]);

  useEffect(() => {
    let isActive = true;

    if (!user?.id) {
      setShortlistState({
        actionKey: "",
        error: "",
        items: [],
        loading: false,
      });
      return () => {
        isActive = false;
      };
    }

    setShortlistState((state) => ({
      ...state,
      error: "",
      loading: true,
    }));

    loadShortlist(user.id)
      .then((items) => {
        if (!isActive) return;
        setShortlistState({
          actionKey: "",
          error: "",
          items,
          loading: false,
        });
      })
      .catch((error) => {
        if (!isActive) return;
        setShortlistState({
          actionKey: "",
          error: readShortlistError(error),
          items: [],
          loading: false,
        });
      });

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  const currentState = useMemo(() => {
    if (!playerName) {
      return {
        status: "error",
        result: null,
        error: {
          code: "MISSING_PLAYER",
          message: "No player was selected for analysis.",
          matches: [],
        },
      };
    }

    return requestState.key === requestKey
      ? requestState
      : {
          status: "loading",
          result: null,
          error: null,
        };
  }, [playerName, requestKey, requestState]);

  const models = useMemo(
    () => Object.entries(currentState.result?.results || {}),
    [currentState.result]
  );
  const totalRecommendations = countModelResults(currentState.result?.results);
  const currentAiState =
    aiState.key === aiRequestKey
      ? aiState
      : {
          key: aiRequestKey,
          status: "idle",
          result: null,
          error: null,
        };
  const shortlistKeys = useMemo(
    () =>
      new Set(
        shortlistState.items
          .map((item) => item.player_key)
          .filter(Boolean)
      ),
    [shortlistState.items]
  );
  const targetPlayer = currentState.result?.target;
  const targetPlayerKey = targetPlayer ? getPlayerKey(targetPlayer) : "";
  const isTargetSaved = shortlistKeys.has(targetPlayerKey);

  useEffect(() => {
    if (
      !user?.id ||
      currentState.status !== "success" ||
      !currentState.result
    ) {
      return;
    }

    const targetName = currentState.result.target?.Name || playerName;
    const historyKey = `${user.id}:${targetName}:${currentState.key || requestKey}`;

    if (recordedHistoryKeys.current.has(historyKey)) {
      return;
    }

    recordedHistoryKeys.current.add(historyKey);
    recordSearch(user.id, targetName, {
      status: "success",
      requestedQuery: playerName,
      resultCount: countModelResults(currentState.result.results),
      submittedFrom: "result_page",
    }).catch((error) => {
      setShortlistState((state) => ({
        ...state,
        error: readShortlistError(error),
      }));
    });
  }, [currentState, playerName, requestKey, user?.id]);

  function retry() {
    clearRecommendationCache(playerName);
    setReloadToken((value) => value + 1);
  }

  function selectPlayer(name) {
    setSearchParams({ player: name });
  }

  async function toggleShortlist(player, source) {
    if (!user?.id) {
      setShortlistState((state) => ({
        ...state,
        error: "Sign in is required to save players.",
      }));
      return;
    }

    const playerKey = getPlayerKey(player);
    if (!playerKey) {
      setShortlistState((state) => ({
        ...state,
        error: "Could not identify this player.",
      }));
      return;
    }

    const isSaved = shortlistKeys.has(playerKey);

    setShortlistState((state) => ({
      ...state,
      actionKey: playerKey,
      error: "",
    }));

    try {
      if (isSaved) {
        await removeShortlistPlayer(user.id, playerKey);
        setShortlistState((state) => ({
          ...state,
          actionKey: "",
          items: state.items.filter((item) => item.player_key !== playerKey),
        }));
        return;
      }

      const item = await upsertShortlistPlayer(user.id, player, source);
      setShortlistState((state) => ({
        ...state,
        actionKey: "",
        items: [
          item,
          ...state.items.filter(
            (existingItem) => existingItem.player_key !== item.player_key
          ),
        ],
      }));
    } catch (error) {
      setShortlistState((state) => ({
        ...state,
        actionKey: "",
        error: readShortlistError(error),
      }));
    }
  }

  async function generateAiAnalysis() {
    const activeKey = aiRequestKey;

    setAiState({
      key: activeKey,
      status: "loading",
      result: null,
      error: null,
    });

    try {
      const result = await getAiAnalysis(playerName);
      setAiState((state) =>
        state.key === activeKey
          ? {
              key: activeKey,
              status: "success",
              result,
              error: null,
            }
          : state
      );
    } catch (error) {
      setAiState((state) =>
        state.key === activeKey
          ? {
              key: activeKey,
              status: "error",
              result: null,
              error: readAiApiError(error),
            }
          : state
      );
    }
  }

  function retryAiAnalysis() {
    clearAiAnalysisCache(playerName);
    generateAiAnalysis();
  }

  return (
    <AppShell>
      {currentState.status === "loading" && <LoadingState playerName={playerName} />}

      {currentState.status === "error" && currentState.error && (
        <ErrorState
          error={currentState.error}
          onRetry={retry}
          onSelectPlayer={selectPlayer}
        />
      )}

      {currentState.status === "success" && currentState.result && (
        <>
          <ReportBreadcrumb playerName={currentState.result.target.Name} />

          <section className="report-hero">
            <div>
              <span className="section-kicker">Scouting report</span>
              <h1 className="page-title">{currentState.result.target.Name}</h1>
              <p className="page-subtitle">
                {currentState.result.target.Display_Name}
              </p>
            </div>

            <div className="report-hero-actions">
              <ShortlistButton
                disabled={
                  shortlistState.loading ||
                  shortlistState.actionKey === targetPlayerKey
                }
                isSaved={isTargetSaved}
                onClick={() =>
                  toggleShortlist(currentState.result.target, "Target player")
                }
              />
            </div>
          </section>

          <div className="report-metrics">
            <ReportMetric
              label="Position"
              value={formatValue(getPlayerPosition(currentState.result.target))}
            />
            <ReportMetric
              label="Age"
              value={formatValue(currentState.result.target.Age)}
            />
            <ReportMetric
              detail={`Potential ${formatValue(getPlayerPa(currentState.result.target))}`}
              label="Current ability"
              value={formatValue(getPlayerCa(currentState.result.target))}
            />
            <ReportMetric
              label="Market value"
              value={formatCompactCurrency(currentState.result.target.MarketValue)}
            />
          </div>

          {shortlistState.error && (
            <Alert
              message={shortlistState.error}
              showIcon
              style={{ marginBottom: 16 }}
              type="warning"
            />
          )}

          <TargetAttributes target={currentState.result.target} />

          <AiAnalysisPanel
            aiState={currentAiState}
            shortlistActionKey={shortlistState.actionKey}
            shortlistKeys={shortlistKeys}
            onGenerate={generateAiAnalysis}
            onRetry={retryAiAnalysis}
            onToggleShortlist={toggleShortlist}
          />

          <Card
            className="model-card report-section"
            title={
              <Space>
                <BarChartOutlined />
                <span>Model recommendations</span>
              </Space>
            }
          >
            <div className="model-summary-grid">
              <div>
                <Text type="secondary">Candidates found</Text>
                <Text strong>{totalRecommendations}</Text>
              </div>
              <div>
                <Text type="secondary">Attributes compared</Text>
                <Text strong>
                  {formatValue(currentState.result.model?.featureCount)}
                </Text>
              </div>
              <div>
                <Text type="secondary">Matching approaches</Text>
                <Text strong>{models.length}</Text>
              </div>
            </div>

            <Tabs
              className="model-tabs"
              items={models.map(([modelName, players], index) => {
                const style = modelStyles[index % modelStyles.length];
                return {
                  key: modelName,
                  label: (
                    <span className="model-tab-label">
                      <Tag color={style.tag}>{style.badge}</Tag>
                      <span>{players.length}</span>
                    </span>
                  ),
                  children: (
                    <ModelTable
                      modelBadge={style.badge}
                      modelDescription={style.description}
                      modelName={modelName}
                      players={players}
                      shortlistActionKey={shortlistState.actionKey}
                      shortlistKeys={shortlistKeys}
                      style={style}
                      onToggleShortlist={toggleShortlist}
                    />
                  ),
                };
              })}
            />
          </Card>
        </>
      )}
    </AppShell>
  );
}

export default Result;
