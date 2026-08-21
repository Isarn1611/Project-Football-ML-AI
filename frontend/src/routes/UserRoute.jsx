import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { ADMIN_HOME_PATH } from "./rolePaths";

function UserRoute() {
  const { isAdmin } = useAuth();

  if (isAdmin) {
    return <Navigate to={ADMIN_HOME_PATH} replace />;
  }

  return <Outlet />;
}

export default UserRoute;
