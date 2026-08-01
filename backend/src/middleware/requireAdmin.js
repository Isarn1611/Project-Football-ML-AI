const { getSupabaseAdminClient } = require("../config/supabase");

function sendForbidden(res, message = "Administrator access is required") {
  return res.status(403).json({
    code: "FORBIDDEN",
    message,
  });
}

async function getUserRole(userId) {
  const { data, error } = await getSupabaseAdminClient()
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    const roleError = new Error("Could not verify administrator role");
    roleError.status = 503;
    roleError.code = "ADMIN_ROLE_UNAVAILABLE";
    roleError.details = error;
    throw roleError;
  }

  return data?.role || "user";
}

async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Authentication is required",
      });
    }

    const readUserRole = req.app.locals.getUserRole || getUserRole;
    const role = await readUserRole(req.user.id);

    if (role !== "admin") {
      return sendForbidden(res);
    }

    req.userRole = role;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getUserRole,
  requireAdmin,
  sendForbidden,
};
