import { Navigate, Route, Routes } from "react-router-dom";

import Result from "../pages/Result";
import Search from "../pages/Search";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Search />} />
      <Route path="/result" element={<Result />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
