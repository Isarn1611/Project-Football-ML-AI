import { Navigate, Route, Routes } from "react-router-dom";

import Login from "../pages/Login";
import Result from "../pages/Result";
import Search from "../pages/Search";
import ProtectedRoute from "./ProtectedRoute";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Search />} />
        <Route path="/result" element={<Result />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
