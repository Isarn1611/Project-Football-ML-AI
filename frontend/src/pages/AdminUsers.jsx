import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  Card,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  CrownOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";
import { getAdminUsers, updateAdminUserRole } from "../services/api";

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
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingUserId, setUpdatingUserId] = useState(null);

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

  const columns = [
      {
        key: "user",
        title: t("users.columns.user"),
        render: (_, user) => (
          <div className="admin-user-identity">
            <Avatar className="admin-user-avatar">{getInitials(user)}</Avatar>
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

          if (isCurrentUser) {
            return <Text type="secondary">{t("users.currentAccount")}</Text>;
          }

          return (
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
                icon={nextRole === "admin" ? <CrownOutlined /> : <UserOutlined />}
                loading={updatingUserId === user.id}
                size="small"
              >
                {t(`users.actions.${nextRole}`)}
              </Button>
            </Popconfirm>
          );
        },
        width: 160,
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
            <Input.Search
              allowClear
              aria-label={t("users.search.label")}
              enterButton={t("users.search.action")}
              onSearch={(value) =>
                requestUsers({ page: 1, query: value, reload: true })
              }
              placeholder={t("users.search.placeholder")}
            />
            <Text type="secondary">
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
            scroll={{ x: 980 }}
          />
        </Card>
      </main>
    </AppShell>
  );
}

export default AdminUsers;
