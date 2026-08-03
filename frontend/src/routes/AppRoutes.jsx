import { Navigate, Route, Routes } from "react-router-dom";

import AuthCallback from "../pages/AuthCallback";
import Login from "../pages/Login";
import ResetPassword from "../pages/ResetPassword";
import Admin from "../pages/Admin";
import AdminPlayers from "../pages/AdminPlayers";
import AdminUsers from "../pages/AdminUsers";
import Result from "../pages/Result";
import Search from "../pages/Search";
import AdminRoute from "./AdminRoute";
import ProtectedRoute from "./ProtectedRoute";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Search />} />
        <Route path="/result" element={<Result />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/players" element={<AdminPlayers />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
