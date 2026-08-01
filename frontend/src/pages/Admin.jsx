import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Spin, Statistic, Tag, Typography } from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  DatabaseOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  TeamOutlined,
} from "@ant-design/icons";

import AppShell from "../components/AppShell";
import { getAdminDashboard } from "../services/api";

const { Paragraph, Text, Title } = Typography;

function Admin() {
  const { i18n, t } = useTranslation("admin");
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setDashboard(await getAdminDashboard());
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    getAdminDashboard()
      .then((result) => {
        if (isActive) {
          setDashboard(result);
        }
      })
      .catch((requestError) => {
        if (isActive) {
          setError(requestError);
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const metrics = [
    {
      key: "users",
      icon: <TeamOutlined />,
      label: t("metrics.users"),
      value: dashboard?.counts?.users,
    },
    {
      key: "players",
      icon: <DatabaseOutlined />,
      label: t("metrics.players"),
      value: dashboard?.counts?.players,
    },
    {
      key: "shortlistItems",
      icon: <StarOutlined />,
      label: t("metrics.shortlist"),
      value: dashboard?.counts?.shortlistItems,
    },
    {
      key: "searchHistoryItems",
      icon: <HistoryOutlined />,
      label: t("metrics.searchHistory"),
      value: dashboard?.counts?.searchHistoryItems,
    },
  ];

  const generatedAt = dashboard?.generatedAt
    ? new Intl.DateTimeFormat(i18n.language === "th" ? "th-TH" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date(dashboard.generatedAt))
    : null;

  return (
    <AppShell
      extra={
        <Tag color="green" icon={<SafetyCertificateOutlined />}>
          {t("badge")}
        </Tag>
      }
    >
      <main className="admin-workspace">
        <section className="admin-hero">
          <div>
            <span className="section-kicker">{t("kicker")}</span>
            <Title className="page-title" level={1}>
              {t("title")}
            </Title>
            <Paragraph className="page-subtitle">{t("subtitle")}</Paragraph>
          </div>

          <div className="admin-hero-actions">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/")}
            >
              {t("actions.back")}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={loadDashboard}
              type="primary"
            >
              {loading ? t("actions.refreshing") : t("actions.refresh")}
            </Button>
          </div>
        </section>

        {error && (
          <Alert
            action={
              <Button onClick={loadDashboard} size="small">
                {t("actions.retry")}
              </Button>
            }
            description={t("errors.dashboard")}
            message={t("errors.title")}
            showIcon
            type="error"
          />
        )}

        <section className="admin-metric-grid" aria-busy={loading}>
          {metrics.map((metric) => (
            <Card className="admin-metric-card" key={metric.key}>
              <span className="admin-metric-icon">{metric.icon}</span>
              {loading && !dashboard ? (
                <Spin size="small" />
              ) : (
                <Statistic
                  groupSeparator=","
                  title={metric.label}
                  value={metric.value ?? 0}
                />
              )}
            </Card>
          ))}
        </section>

        <Card className="admin-status-card">
          <div className="admin-status-heading">
            <div>
              <Text className="section-kicker">{t("status.kicker")}</Text>
              <Title level={2}>{t("status.title")}</Title>
            </div>
            {generatedAt && (
              <Text type="secondary">
                {t("status.updated", { time: generatedAt })}
              </Text>
            )}
          </div>

          <div className="admin-status-grid">
            {["database", "access", "audit"].map((key) => (
              <div className="admin-status-item" key={key}>
                <CheckCircleFilled />
                <span>
                  <strong>{t(`status.${key}.title`)}</strong>
                  <small>{t(`status.${key}.description`)}</small>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </AppShell>
  );
}

export default Admin;
