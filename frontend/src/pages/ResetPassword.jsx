import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Spin, Typography } from "antd";
import { ArrowRightOutlined, LockOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";

const { Paragraph, Title } = Typography;

function ResetPassword() {
  const { t } = useTranslation("auth");
  const { isAuthenticated, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [formState, setFormState] = useState({ loading: false, error: "" });

  if (loading) {
    return (
      <main className="login-shell">
        <Spin size="large" />
      </main>
    );
  }

  if (!isAuthenticated || !supabase) {
    return <Navigate to="/login" replace />;
  }

  async function handleSubmit(values) {
    setFormState({ loading: true, error: "" });
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      setFormState({ loading: false, error: error.message });
      return;
    }

    await refresh();
    navigate("/app", { replace: true });
  }

  return (
    <main className="login-shell">
      <Card className="reset-password-card">
        <Title level={2}>{t("chooseNewPassword")}</Title>
        <Paragraph type="secondary">
          {t("chooseNewPasswordDescription")}
        </Paragraph>

        {formState.error && (
          <Alert message={formState.error} showIcon type="error" />
        )}

        <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            label={t("newPassword")}
            name="password"
            rules={[
              { required: true, message: t("passwordRequired") },
              { min: 6, message: t("passwordMin") },
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              prefix={<LockOutlined />}
              size="large"
            />
          </Form.Item>
          <Form.Item
            dependencies={["password"]}
            label={t("confirmPassword")}
            name="confirmPassword"
            rules={[
              { required: true, message: t("confirmPasswordRequired") },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue("password") === value
                    ? Promise.resolve()
                    : Promise.reject(new Error(t("passwordsDoNotMatch")));
                },
              }),
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              prefix={<LockOutlined />}
              size="large"
            />
          </Form.Item>
          <Button
            block
            htmlType="submit"
            loading={formState.loading}
            size="large"
            type="primary"
          >
            {t("saveNewPassword")} <ArrowRightOutlined />
          </Button>
        </Form>
      </Card>
    </main>
  );
}

export default ResetPassword;
