import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Card, Spin, Typography } from "antd";

import { useAuth } from "../auth/useAuth";

const { Text } = Typography;

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="login-shell">
        <section className="state-center">
          <Card style={{ minWidth: 260, textAlign: "center" }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text strong>Opening workspace</Text>
            </div>
          </Card>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
