import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  Card,
  Drawer,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CrownOutlined,
  EyeOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";
import {
  getAdminUsers,
  getAdminUserUsage,
  updateAdminUserRole,
  updateAdminUserSuspension,
} from "../services/api";
import { getUserAvatarUrl } from "../utils/userProfile";

const { Paragraph, Text, Title } = Typography;
const PAGE_SIZE = 20;

function formatDateTime(value, language, fallback) {
  if (!value) return fallback;

  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getInitials(user) {
  const label = user.displayName || user.email || "U";
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function AdminUsers() {
  const { message } = AntApp.useApp();
  const { user: currentUser } = useAuth();
  const { i18n, t } = useTranslation("admin");
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
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
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [usage, setUsage] = useState(null);
  const [usageDays, setUsageDays] = useState(30);
  const [usageLoading, setUsageLoading] = useState(false);
  const [suspensionUser, setSuspensionUser] = useState(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [suspensionSaving, setSuspensionSaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    getAdminUsers({
      page: pagination.page,
      pageSize: pagination.pageSize,
      q: query,
    })
      .then((result) => {
        if (!isActive) return;
        setUsers(result.users || []);
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
  }, [pagination.page, pagination.pageSize, query, reloadKey]);

  function requestUsers(next = {}) {
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

  async function changeRole(targetUser, role) {
    setUpdatingUserId(targetUser.id);
    setError(null);

    try {
      const result = await updateAdminUserRole(targetUser.id, role);
      setUsers((current) =>
        current.map((user) =>
          user.id === targetUser.id ? { ...user, ...result.user } : user
        )
      );
      message.success(t("users.feedback.roleUpdated"));
    } catch (requestError) {
      setError(requestError);
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function loadUsage(targetUser, days = usageDays) {
    setSelectedUser(targetUser);
    setUsageLoading(true);
    setError(null);

    try {
      const result = await getAdminUserUsage(targetUser.id, days);
      setUsage(result.usage);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setUsageLoading(false);
    }
  }

  function openSuspension(targetUser) {
    setSuspensionUser(targetUser);
    setSuspensionReason(targetUser.suspensionReason || "");
  }

  function closeSuspension() {
    if (suspensionSaving) return;
    setSuspensionUser(null);
    setSuspensionReason("");
  }

  async function saveSuspension() {
    const shouldSuspend = !suspensionUser.suspendedAt;

    if (shouldSuspend && !suspensionReason.trim()) {
      message.warning(t("users.suspension.reasonRequired"));
      return;
    }

    setSuspensionSaving(true);
    setError(null);

    try {
      const result = await updateAdminUserSuspension(
        suspensionUser.id,
        shouldSuspend,
        suspensionReason
      );
      setUsers((current) =>
        current.map((user) =>
          user.id === suspensionUser.id ? { ...user, ...result.user } : user
        )
      );
      if (selectedUser?.id === suspensionUser.id) {
        setSelectedUser((current) => ({ ...current, ...result.user }));
      }
      message.success(
        t(
          shouldSuspend
            ? "users.feedback.suspended"
            : "users.feedback.reactivated"
        )
      );
      setSuspensionUser(null);
      setSuspensionReason("");
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSuspensionSaving(false);
    }
  }

  const columns = [
      {
        key: "user",
        title: t("users.columns.user"),
        render: (_, user) => (
          <div className="admin-user-identity">
            <Avatar
              className="admin-user-avatar"
              src={getUserAvatarUrl(user) || undefined}
            >
              {getInitials(user)}
            </Avatar>
            <span>
              <strong>{user.displayName || t("users.unknownName")}</strong>
              <small>{user.email || t("users.unknownEmail")}</small>
            </span>
          </div>
        ),
      },
      {
        dataIndex: "provider",
        key: "provider",
        title: t("users.columns.provider"),
        render: (provider) => <Tag>{provider || "email"}</Tag>,
        width: 120,
      },
      {
        dataIndex: "role",
        key: "role",
        title: t("users.columns.role"),
        render: (role) => (
          <Tag color={role === "admin" ? "gold" : "default"}>
            {role === "admin" ? t("users.roles.admin") : t("users.roles.user")}
          </Tag>
        ),
        width: 120,
      },
      {
        key: "status",
        title: t("users.columns.status"),
        render: (_, user) => {
          if (user.suspendedAt) {
            return <Tag color="red">{t("users.status.suspended")}</Tag>;
          }
          const isBanned = user.bannedUntil && new Date(user.bannedUntil) > new Date();
          if (isBanned) return <Tag color="red">{t("users.status.banned")}</Tag>;
          if (!user.emailConfirmedAt) {
            return <Tag color="orange">{t("users.status.pending")}</Tag>;
          }
          return <Tag color="green">{t("users.status.active")}</Tag>;
        },
        width: 120,
      },
      {
        dataIndex: "lastSignInAt",
        key: "lastSignInAt",
        title: t("users.columns.lastSignIn"),
        render: (value) =>
          formatDateTime(value, i18n.language, t("users.neverSignedIn")),
        width: 190,
      },
      {
        key: "actions",
        title: t("users.columns.actions"),
        render: (_, user) => {
          const isCurrentUser = user.id === currentUser?.id;
          const nextRole = user.role === "admin" ? "user" : "admin";

          return (
            <Space size={6} wrap>
              <Button
                icon={<EyeOutlined />}
                onClick={() => loadUsage(user)}
                size="small"
              >
                {t("users.actions.details")}
              </Button>
              {isCurrentUser ? (
                <Text type="secondary">{t("users.currentAccount")}</Text>
              ) : (
                <>
                  <Popconfirm
                    cancelText={t("users.confirm.cancel")}
                    description={t(`users.confirm.${nextRole}.description`, {
                      email: user.email,
                    })}
                    okButtonProps={{ danger: nextRole === "user" }}
                    okText={t(`users.confirm.${nextRole}.confirm`)}
                    onConfirm={() => changeRole(user, nextRole)}
                    title={t(`users.confirm.${nextRole}.title`)}
                  >
                    <Button
                      danger={nextRole === "user"}
                      disabled={Boolean(user.suspendedAt)}
                      icon={
                        nextRole === "admin" ? (
                          <CrownOutlined />
                        ) : (
                          <UserOutlined />
                        )
                      }
                      loading={updatingUserId === user.id}
                      size="small"
                    >
                      {t(`users.actions.${nextRole}`)}
                    </Button>
                  </Popconfirm>
                  <Button
                    danger={!user.suspendedAt}
                    icon={
                      user.suspendedAt ? (
                        <CheckCircleOutlined />
                      ) : (
                        <StopOutlined />
                      )
                    }
                    onClick={() => openSuspension(user)}
                    size="small"
                  >
                    {t(
                      user.suspendedAt
                        ? "users.actions.reactivate"
                        : "users.actions.suspend"
                    )}
                  </Button>
                </>
              )}
            </Space>
          );
        },
        width: 390,
      },
  ];

  return (
    <AppShell
      extra={
        <Tag color="green" icon={<SafetyCertificateOutlined />}>
          {t("badge")}
        </Tag>
      }
    >
      <main className="admin-workspace admin-users-page">
        <section className="admin-users-hero">
          <div>
            <span className="section-kicker">{t("users.kicker")}</span>
            <Title className="page-title" level={1}>
              {t("users.title")}
            </Title>
            <Paragraph className="page-subtitle">{t("users.subtitle")}</Paragraph>
          </div>
          <Space wrap>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/admin")}
            >
              {t("users.actions.back")}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => requestUsers({ reload: true })}
            >
              {t("actions.refresh")}
            </Button>
          </Space>
        </section>

        {error && (
          <Alert
            description={t("users.errors.load")}
            message={t("users.errors.title")}
            showIcon
            type="error"
          />
        )}

        <Card
          className="admin-users-card"
          title={
            <Space>
              <TeamOutlined />
              {t("users.tableTitle")}
            </Space>
          }
        >
          <div className="admin-users-toolbar">
            <div className="admin-users-search" role="search">
              <Input
                allowClear
                aria-label={t("users.search.label")}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchDraft(value);

                  if (!value && query) {
                    requestUsers({ page: 1, query: "", reload: true });
                  }
                }}
                onPressEnter={() =>
                  requestUsers({
                    page: 1,
                    query: searchDraft,
                    reload: true,
                  })
                }
                placeholder={t("users.search.placeholder")}
                value={searchDraft}
              />
              <Button
                aria-label={t("users.search.action")}
                className="admin-users-search-button"
                icon={<SearchOutlined />}
                loading={loading}
                onClick={() =>
                  requestUsers({
                    page: 1,
                    query: searchDraft,
                    reload: true,
                  })
                }
                shape="circle"
              />
            </div>
            <Text className="admin-users-total" type="secondary">
              {t("users.total", { count: pagination.total })}
            </Text>
          </div>

          <Table
            columns={columns}
            dataSource={users}
            loading={loading}
            locale={{ emptyText: t("users.empty") }}
            pagination={{
              current: pagination.page,
              onChange: (page) => requestUsers({ page }),
              pageSize: pagination.pageSize,
              showSizeChanger: false,
              total: pagination.total,
            }}
            rowKey="id"
            scroll={{ x: 1250 }}
          />
        </Card>

        <Drawer
          extra={
            <Select
              onChange={(days) => {
                setUsageDays(days);
                loadUsage(selectedUser, days);
              }}
              options={[
                { label: t("users.usage.days7"), value: 7 },
                { label: t("users.usage.days30"), value: 30 },
                { label: t("users.usage.days90"), value: 90 },
              ]}
              value={usageDays}
            />
          }
          onClose={() => {
            setSelectedUser(null);
            setUsage(null);
          }}
          open={Boolean(selectedUser)}
          title={t("users.usage.title", {
            email: selectedUser?.email || t("users.unknownEmail"),
          })}
          width={760}
        >
          <div className="admin-usage-drawer">
            <div className="admin-usage-profile">
              <Avatar
                className="admin-user-avatar"
                size={46}
                src={getUserAvatarUrl(selectedUser) || undefined}
              >
                {selectedUser ? getInitials(selectedUser) : "U"}
              </Avatar>
              <span className="admin-usage-profile-copy">
                <strong>
                  {selectedUser?.displayName || t("users.unknownName")}
                </strong>
                <small>{selectedUser?.email}</small>
              </span>
              {selectedUser?.suspendedAt && (
                <Tag color="red">{t("users.status.suspended")}</Tag>
              )}
            </div>

            <div className="admin-usage-metric-grid">
              <Card loading={usageLoading}>
                <Statistic
                  prefix={<SearchOutlined />}
                  title={t("users.usage.searches")}
                  value={usage?.lifetime?.searches || 0}
                />
              </Card>
              <Card loading={usageLoading}>
                <Statistic
                  prefix={<ThunderboltOutlined />}
                  title={t("users.usage.totalTokens")}
                  value={usage?.lifetime?.totalTokens || 0}
                />
              </Card>
              <Card loading={usageLoading}>
                <Statistic
                  title={t("users.usage.aiRequests")}
                  value={usage?.lifetime?.aiRequests || 0}
                />
              </Card>
              <Card loading={usageLoading}>
                <Statistic
                  prefix={<ClockCircleOutlined />}
                  title={t("users.usage.lastActive")}
                  value={formatDateTime(
                    usage?.lifetime?.lastActiveAt,
                    i18n.language,
                    t("users.neverSignedIn")
                  )}
                />
              </Card>
            </div>

            <Card
              className="admin-usage-section"
              loading={usageLoading}
              title={t("users.usage.periodSummary", {
                days: usage?.periodDays || usageDays,
              })}
            >
              <div className="admin-usage-summary-row">
                <span>
                  <small>{t("users.usage.promptTokens")}</small>
                  <strong>{formatNumber(usage?.period?.promptTokens)}</strong>
                </span>
                <span>
                  <small>{t("users.usage.outputTokens")}</small>
                  <strong>{formatNumber(usage?.period?.outputTokens)}</strong>
                </span>
                <span>
                  <small>{t("users.usage.averageDuration")}</small>
                  <strong>
                    {formatNumber(usage?.period?.averageDurationMs)} ms
                  </strong>
                </span>
              </div>
            </Card>

          </div>
        </Drawer>

        <Modal
          cancelText={t("users.suspension.cancel")}
          confirmLoading={suspensionSaving}
          okButtonProps={{ danger: !suspensionUser?.suspendedAt }}
          okText={t(
            suspensionUser?.suspendedAt
              ? "users.suspension.reactivate"
              : "users.suspension.suspend"
          )}
          onCancel={closeSuspension}
          onOk={saveSuspension}
          open={Boolean(suspensionUser)}
          title={t(
            suspensionUser?.suspendedAt
              ? "users.suspension.reactivateTitle"
              : "users.suspension.suspendTitle"
          )}
        >
          <Paragraph>
            {t(
              suspensionUser?.suspendedAt
                ? "users.suspension.reactivateDescription"
                : "users.suspension.suspendDescription",
              { email: suspensionUser?.email }
            )}
          </Paragraph>
          {!suspensionUser?.suspendedAt && (
            <Input.TextArea
              maxLength={500}
              onChange={(event) => setSuspensionReason(event.target.value)}
              placeholder={t("users.suspension.reasonPlaceholder")}
              rows={4}
              showCount
              value={suspensionReason}
            />
          )}
        </Modal>
      </main>
    </AppShell>
  );
}

export default AdminUsers;
