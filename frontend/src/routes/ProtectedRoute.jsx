import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../auth/useAuth";

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07110d] px-5 text-center text-slate-100">
        <div>
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-emerald-300" />
          <p className="text-sm font-semibold text-slate-300">
            Checking session
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
