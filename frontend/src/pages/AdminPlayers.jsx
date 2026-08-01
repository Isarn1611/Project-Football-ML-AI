import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  DatabaseOutlined,
  EditOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

import AppShell from "../components/AppShell";
import { getAdminPlayers, updateAdminPlayer } from "../services/api";

const { Paragraph, Text, Title } = Typography;
const PAGE_SIZE = 20;

function getInitials(name) {
  return String(name || "P")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatMoney(value) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) return "—";

  return new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(Number(value));
}

function AdminPlayers() {
  const { message } = AntApp.useApp();
  const { t } = useTranslation("admin");
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [players, setPlayers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
  });
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    getAdminPlayers({
      page: pagination.page,
      pageSize: pagination.pageSize,
      q: query,
    })
      .then((result) => {
        if (!isActive) return;
        setPlayers(result.players || []);
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

  function requestPlayers(next = {}) {
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

  function openEditor(player) {
    setEditingPlayer(player);
    form.setFieldsValue(player);
  }

  function closeEditor() {
    if (saving) return;
    setEditingPlayer(null);
    form.resetFields();
  }

  async function savePlayer() {
    try {
      const values = await form.validateFields();
      setSaving(true);
      setError(null);
      const result = await updateAdminPlayer(editingPlayer.uid, values);

      setPlayers((current) =>
        current.map((player) =>
          player.uid === editingPlayer.uid ? result.player : player
        )
      );
      message.success(t("players.feedback.updated"));
      setEditingPlayer(null);
      form.resetFields();
    } catch (requestError) {
      if (!requestError?.errorFields) {
        setError(requestError);
      }
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: "player",
      title: t("players.columns.player"),
      render: (_, player) => (
        <div className="admin-player-identity">
          <Avatar className="admin-player-avatar">
            {getInitials(player.name)}
          </Avatar>
          <span>
            <strong>{player.name}</strong>
            <small>UID {player.uid}</small>
          </span>
        </div>
      ),
    },
    {
      dataIndex: "club",
      key: "club",
      title: t("players.columns.club"),
      render: (value) => value || "—",
      width: 190,
    },
    {
      dataIndex: "age",
      key: "age",
      title: t("players.columns.age"),
      width: 80,
    },
    {
      dataIndex: "position",
      key: "position",
      title: t("players.columns.position"),
      render: (value) => <Tag>{value || "—"}</Tag>,
      width: 130,
    },
    {
      key: "ability",
      title: t("players.columns.ability"),
      render: (_, player) => (
        <Space size={6}>
          <Tag color="green">CA {player.currentAbility}</Tag>
          <Tag color="blue">PA {player.potentialAbility}</Tag>
        </Space>
      ),
      width: 170,
    },
    {
      dataIndex: "marketValue",
      key: "marketValue",
      title: t("players.columns.value"),
      render: formatMoney,
      width: 125,
    },
    {
      key: "actions",
      title: t("players.columns.actions"),
      render: (_, player) => (
        <Button
          icon={<EditOutlined />}
          onClick={() => openEditor(player)}
          size="small"
        >
          {t("players.actions.edit")}
        </Button>
      ),
      width: 110,
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
      <main className="admin-workspace admin-players-page">
        <section className="admin-users-hero">
          <div>
            <span className="section-kicker">{t("players.kicker")}</span>
            <Title className="page-title" level={1}>
              {t("players.title")}
            </Title>
            <Paragraph className="page-subtitle">
              {t("players.subtitle")}
            </Paragraph>
          </div>
          <Space wrap>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/admin")}
            >
              {t("players.actions.back")}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => requestPlayers({ reload: true })}
            >
              {t("actions.refresh")}
            </Button>
          </Space>
        </section>

        {error && (
          <Alert
            description={t("players.errors.load")}
            message={t("players.errors.title")}
            showIcon
            type="error"
          />
        )}

        <Alert
          description={t("players.sync.description")}
          message={t("players.sync.title")}
          showIcon
          type="warning"
        />

        <Card
          className="admin-users-card admin-players-card"
          title={
            <Space>
              <DatabaseOutlined />
              {t("players.tableTitle")}
            </Space>
          }
        >
          <div className="admin-users-toolbar">
            <Input.Search
              allowClear
              aria-label={t("players.search.label")}
              enterButton={t("players.search.action")}
              onSearch={(value) =>
                requestPlayers({ page: 1, query: value, reload: true })
              }
              placeholder={t("players.search.placeholder")}
            />
            <Text type="secondary">
              {t("players.total", { count: pagination.total })}
            </Text>
          </div>

          <Table
            columns={columns}
            dataSource={players}
            loading={loading}
            locale={{ emptyText: t("players.empty") }}
            pagination={{
              current: pagination.page,
              onChange: (page) => requestPlayers({ page }),
              pageSize: pagination.pageSize,
              showSizeChanger: false,
              total: pagination.total,
            }}
            rowKey="uid"
            scroll={{ x: 1050 }}
          />
        </Card>

        <Modal
          cancelText={t("players.editor.cancel")}
          confirmLoading={saving}
          destroyOnHidden
          okText={t("players.editor.save")}
          onCancel={closeEditor}
          onOk={savePlayer}
          open={Boolean(editingPlayer)}
          title={t("players.editor.title")}
          width={720}
        >
          {editingPlayer && (
            <div className="admin-player-editor">
              <div className="admin-player-editor-summary">
                <Avatar className="admin-player-avatar" size={42}>
                  {getInitials(editingPlayer.name)}
                </Avatar>
                <span>
                  <strong>{editingPlayer.name}</strong>
                  <small>UID {editingPlayer.uid}</small>
                </span>
              </div>

              <Form form={form} layout="vertical" requiredMark={false}>
                <div className="admin-player-form-grid">
                  <Form.Item
                    className="is-wide"
                    label={t("players.fields.name")}
                    name="name"
                    rules={[{ required: true, whitespace: true }]}
                  >
                    <Input disabled maxLength={120} />
                  </Form.Item>
                  <Form.Item label={t("players.fields.club")} name="club">
                    <Input maxLength={120} />
                  </Form.Item>
                  <Form.Item
                    label={t("players.fields.nationality")}
                    name="nationality"
                    rules={[{ required: true, whitespace: true }]}
                  >
                    <Input maxLength={120} />
                  </Form.Item>
                  <Form.Item
                    label={t("players.fields.position")}
                    name="position"
                    rules={[{ required: true, whitespace: true }]}
                  >
                    <Input maxLength={120} />
                  </Form.Item>
                  <Form.Item
                    label={t("players.fields.age")}
                    name="age"
                    rules={[{ required: true }]}
                  >
                    <InputNumber max={60} min={15} />
                  </Form.Item>
                  <Form.Item
                    label={t("players.fields.currentAbility")}
                    name="currentAbility"
                    rules={[{ required: true }]}
                  >
                    <InputNumber max={200} min={0} />
                  </Form.Item>
                  <Form.Item
                    label={t("players.fields.potentialAbility")}
                    name="potentialAbility"
                    rules={[{ required: true }]}
                  >
                    <InputNumber max={200} min={0} />
                  </Form.Item>
                  <Form.Item
                    label={t("players.fields.marketValue")}
                    name="marketValue"
                    rules={[{ required: true }]}
                  >
                    <InputNumber max={10000000000} min={-1} />
                  </Form.Item>
                  <Form.Item
                    label={t("players.fields.salary")}
                    name="salary"
                    rules={[{ required: true }]}
                  >
                    <InputNumber max={1000000000} min={0} />
                  </Form.Item>
                </div>
              </Form>
            </div>
          )}
        </Modal>
      </main>
    </AppShell>
  );
}

export default AdminPlayers;
