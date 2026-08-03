import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Empty, Modal, Space, Spin, Table, Typography } from "antd";
import {
  ClearOutlined,
  DeleteOutlined,
  HistoryOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";
import {
  clearSearchHistory,
  loadSearchHistory,
  removeSearchHistoryItem,
} from "../services/scoutingData";
import { lookupPlayersByNames } from "../services/api";
import PlayerAvatar from "../services/playerImages.jsx";

const { Text } = Typography;
const SEARCH_HISTORY_CHANGE_EVENT = "scoutai-search-history-change";

function formatDateTime(value, t, language) {
  if (!value) return t("players.unknownTime");

  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function readHistoryError(error, t) {
  const message = error?.message || t("errors.workspace");

  if (
    message.includes("player_search_history") ||
    message.includes("row-level security policy")
  ) {
    return t("errors.historyPolicyMigration");
  }

  return message;
}

function notifyHistoryChanged() {
  window.dispatchEvent(new Event(SEARCH_HISTORY_CHANGE_EVENT));
}

function getHistoryPlayerUid(item) {
  return (
    item?.resolved_player_uid ||
    item?.player_uid ||
    item?.metadata?.playerUid ||
    item?.metadata?.player_uid ||
    null
  );
}

function SearchHistoryOverlay({ onClose, open }) {
  const { i18n, t } = useTranslation("search");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: false,
    error: "",
    items: [],
  });

  useEffect(() => {
    let isActive = true;

    if (!open || !user?.id) return () => {
      isActive = false;
    };

    setState((current) => ({ ...current, loading: true, error: "" }));
    loadSearchHistory(user.id)
      .then(async (items) => {
        const unresolvedNames = items
          .filter((item) => !getHistoryPlayerUid(item))
          .map((item) => item.query);
        let resolvedItems = items;

        if (unresolvedNames.length) {
          try {
            const result = await lookupPlayersByNames(unresolvedNames);
            const uidByName = new Map(
              (result.players || []).map((player) => [
                String(player.name || "").trim().toLocaleLowerCase(),
                player.uid,
              ])
            );

            resolvedItems = items.map((item) => ({
              ...item,
              resolved_player_uid:
                getHistoryPlayerUid(item) ||
                uidByName.get(
                  String(item.query || "").trim().toLocaleLowerCase()
                ) ||
                null,
            }));
          } catch {
            // History remains usable with initials if the lookup is unavailable.
          }
        }

        if (!isActive) return;
        setState({ loading: false, error: "", items: resolvedItems });
      })
      .catch((error) => {
        if (!isActive) return;
        setState({
          loading: false,
          error: readHistoryError(error, t),
          items: [],
        });
      });

    return () => {
      isActive = false;
    };
  }, [open, t, user?.id]);

  async function removeItem(id) {
    if (!user?.id) return;

    try {
      await removeSearchHistoryItem(user.id, id);
      setState((current) => ({
        ...current,
        error: "",
        items: current.items.filter((item) => item.id !== id),
      }));
      notifyHistoryChanged();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: readHistoryError(error, t),
      }));
    }
  }

  async function clearItems() {
    if (!user?.id) return;

    try {
      await clearSearchHistory(user.id);
      setState((current) => ({ ...current, error: "", items: [] }));
      notifyHistoryChanged();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: readHistoryError(error, t),
      }));
    }
  }

  function openReport(query) {
    const player = String(query || "").trim();
    if (!player) return;

    onClose();
    navigate(`/result?${new URLSearchParams({ player })}`);
  }

  const columns = [
    {
      dataIndex: "query",
      key: "query",
      title: t("history.search"),
      render: (query, item) => (
        <div className="workspace-player">
          <PlayerAvatar
            className="workspace-row-avatar is-history"
            name={query}
            uid={getHistoryPlayerUid(item)}
          />
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
            onClick={() => openReport(item.query)}
          >
            {t("actions.open")}
          </Button>
          <Button
            aria-label={t("history.deleteAria", { name: item.query })}
            className="workspace-remove-button"
            danger
            icon={<DeleteOutlined />}
            onClick={() => removeItem(item.id)}
            title={t("history.deleteAria", { name: item.query })}
            type="text"
          />
        </Space>
      ),
    },
  ];

  return (
    <Modal
      className="search-history-modal"
      destroyOnHidden
      footer={null}
      onCancel={onClose}
      open={open}
      title={t("history.title")}
      width={900}
    >
      <div className="search-workspace search-history-overlay">
        <div className="search-history-overlay-heading">
          <div className="workspace-card-heading">
            <span className="workspace-card-icon">
              <HistoryOutlined />
            </span>
            <span className="workspace-card-title">
              <strong>{t("history.title")}</strong>
              <small>{t("history.subtitle")}</small>
            </span>
            <span className="workspace-card-count">{state.items.length}</span>
          </div>
          {state.items.length > 0 && (
            <Button danger icon={<ClearOutlined />} onClick={clearItems} type="text">
              {t("actions.clear")}
            </Button>
          )}
        </div>

        {state.error && (
          <Alert message={state.error} showIcon type="warning" />
        )}

        {state.loading ? (
          <div className="search-history-overlay-loading">
            <Spin />
          </div>
        ) : (
          <Card className="workspace-card history-card">
            <Table
              columns={columns}
              dataSource={state.items}
              locale={{
                emptyText: (
                  <Empty
                    description={t("history.empty")}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
              pagination={state.items.length > 5 ? { pageSize: 5 } : false}
              rowKey="id"
              scroll={{ x: 560 }}
              size="middle"
            />
          </Card>
        )}
      </div>
    </Modal>
  );
}

export default SearchHistoryOverlay;
