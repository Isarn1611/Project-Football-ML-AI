import { Navigate, Route, Routes } from "react-router-dom";

import AuthCallback from "../pages/AuthCallback";
import About from "../pages/About";
import Home from "../pages/Home";
import Login from "../pages/Login";
import Privacy from "../pages/Privacy";
import Terms from "../pages/Terms";
import Pricing from "../pages/Pricing";
import ResetPassword from "../pages/ResetPassword";
import Admin from "../pages/Admin";
import AdminActivity from "../pages/AdminActivity";
import AdminPlayers from "../pages/AdminPlayers";
import AdminUsers from "../pages/AdminUsers";
import Result from "../pages/Result";
import Search from "../pages/Search";
import AdminRoute from "./AdminRoute";
import ProtectedRoute from "./ProtectedRoute";
import UserRoute from "./UserRoute";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<UserRoute />}>
          <Route path="/app" element={<Search />} />
          <Route path="/result" element={<Result />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<Admin />} />
          <Route
            path="/admin/shortlist"
            element={<AdminActivity type="shortlist" />}
          />
          <Route
            path="/admin/search-history"
            element={<AdminActivity type="searches" />}
          />
          <Route path="/admin/players" element={<AdminPlayers />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
