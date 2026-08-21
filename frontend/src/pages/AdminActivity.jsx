import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Card,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StarOutlined,
} from "@ant-design/icons";

import AppShell from "../components/AppShell";
import {
  getAdminSearchHistory,
  getAdminShortlistEntries,
} from "../services/api";

const { Paragraph, Text, Title } = Typography;
const PAGE_SIZE = 20;

function formatDateTime(value, language) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SourceBreakdown({ sources = {} }) {
  return (
    <Space size={[4, 4]} wrap>
      {Object.entries(sources)
        .sort((left, right) => right[1] - left[1])
        .map(([source, count]) => (
          <Tag color="green" key={source}>
            {source} · {count}
          </Tag>
        ))}
    </Space>
  );
}

function AdminActivity({ type }) {
  const { i18n, t } = useTranslation("admin");
  const navigate = useNavigate();
  const isShortlist = type === "shortlist";
  const sectionKey = isShortlist ? "activity.shortlist" : "activity.searches";
  const loadItems = isShortlist
    ? getAdminShortlistEntries
    : getAdminSearchHistory;
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
  });
  const [query, setQuery] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isActive = true;

    loadItems({
      page: pagination.page,
      pageSize: pagination.pageSize,
      q: query,
    })
      .then((result) => {
        if (!isActive) return;
        setItems(result.items || []);
        setPagination(result.pagination);
      })
      .catch((requestError) => {
        if (isActive) setError(requestError);
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [loadItems, pagination.page, pagination.pageSize, query, reloadKey]);

  function requestItems(next = {}) {
    setError(null);
    setLoading(true);

    if (next.query !== undefined) {
      setQuery(String(next.query || "").trim());
    }

    if (next.page !== undefined) {
      setPagination((current) => ({ ...current, page: next.page }));
    }

    if (next.reload) {
      setReloadKey((current) => current + 1);
    }
  }

  const rankColumn = {
    key: "rank",
    title: t("activity.columns.rank"),
    render: (_, _item, index) => (
      <Text strong>
        {(pagination.page - 1) * pagination.pageSize + index + 1}
      </Text>
    ),
    width: 72,
  };
  const playerColumn = {
    key: "player",
    title: t("activity.columns.player"),
    render: (_, item) => (
      <div className="admin-player-identity">
        <span className="admin-player-avatar">
          {isShortlist ? <StarOutlined /> : <SearchOutlined />}
        </span>
        <span>
          <strong>{item.playerName}</strong>
          <small>{item.club || (item.playerUid ? `UID ${item.playerUid}` : "—")}</small>
        </span>
      </div>
    ),
  };
  const timeColumn = {
    dataIndex: "latestAt",
    key: "latestAt",
    title: t("activity.columns.latest"),
    render: (value) => formatDateTime(value, i18n.language),
    width: 190,
  };
  const columns = isShortlist
    ? [
        rankColumn,
        playerColumn,
        {
          dataIndex: "position",
          key: "position",
          title: t("activity.columns.position"),
          render: (value) => <Tag>{value || "—"}</Tag>,
          width: 140,
        },
        {
          dataIndex: "savedCount",
          key: "savedCount",
          title: t("activity.columns.savedCount"),
          render: (value) => <Text strong>{value}</Text>,
          width: 150,
        },
        {
          dataIndex: "sourceCounts",
          key: "sourceCounts",
          title: t("activity.columns.sources"),
          render: (value) => <SourceBreakdown sources={value} />,
          width: 280,
        },
        timeColumn,
      ]
    : [
        rankColumn,
        playerColumn,
        {
          dataIndex: "searchCount",
          key: "searchCount",
          title: t("activity.columns.searchCount"),
          render: (value) => <Text strong>{value}</Text>,
          width: 170,
        },
        {
          dataIndex: "uniqueAccounts",
          key: "uniqueAccounts",
          title: t("activity.columns.uniqueAccounts"),
          width: 180,
        },
        timeColumn,
      ];

  return (
    <AppShell
      extra={
        <Tag color="green" icon={<SafetyCertificateOutlined />}>
          {t("badge")}
        </Tag>
      }
    >
      <main className="admin-workspace admin-activity-page">
        <section className="admin-users-hero">
          <div>
            <span className="section-kicker">{t(`${sectionKey}.kicker`)}</span>
            <Title className="page-title" level={1}>
              {t(`${sectionKey}.title`)}
            </Title>
            <Paragraph className="page-subtitle">
              {t(`${sectionKey}.subtitle`)}
            </Paragraph>
          </div>
          <Space wrap>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/admin")}
            >
              {t("activity.actions.back")}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => requestItems({ reload: true })}
            >
              {t("actions.refresh")}
            </Button>
          </Space>
        </section>

        <Alert
          description={t("activity.privacy.description")}
          message={t("activity.privacy.title")}
          showIcon
          type="info"
        />

        {error && (
          <Alert
            description={t("activity.errors.load")}
            message={t("activity.errors.title")}
            showIcon
            type="error"
          />
        )}

        <Card
          className="admin-users-card"
          title={
            <Space>
              {isShortlist ? <StarOutlined /> : <HistoryOutlined />}
              {t(`${sectionKey}.tableTitle`)}
            </Space>
          }
        >
          <div className="admin-users-toolbar">
            <div className="admin-users-search" role="search">
              <Input
                allowClear
                aria-label={t("activity.search.label")}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchDraft(value);

                  if (!value && query) {
                    requestItems({ page: 1, query: "", reload: true });
                  }
                }}
                onPressEnter={() =>
                  requestItems({ page: 1, query: searchDraft, reload: true })
                }
                placeholder={t(`${sectionKey}.searchPlaceholder`)}
                value={searchDraft}
              />
              <Button
                aria-label={t("activity.search.action")}
                className="admin-users-search-button"
                icon={<SearchOutlined />}
                loading={loading}
                onClick={() =>
                  requestItems({ page: 1, query: searchDraft, reload: true })
                }
                shape="circle"
              />
            </div>
            <Text className="admin-users-total" type="secondary">
              {t("activity.total", { count: pagination.total })}
            </Text>
          </div>

          <Table
            columns={columns}
            dataSource={items}
            loading={loading}
            locale={{ emptyText: t(`${sectionKey}.empty`) }}
            pagination={{
              current: pagination.page,
              onChange: (page) => requestItems({ page }),
              pageSize: pagination.pageSize,
              showSizeChanger: false,
              total: pagination.total,
            }}
            rowKey="key"
            scroll={{ x: isShortlist ? 1150 : 900 }}
          />
        </Card>
      </main>
    </AppShell>
  );
}

export default AdminActivity;
