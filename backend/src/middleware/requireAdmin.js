const { getSupabaseAdminClient } = require("../config/supabase");

function sendForbidden(res, message = "Administrator access is required") {
  return res.status(403).json({
    code: "FORBIDDEN",
    message,
  });
}

async function getUserAccess(userId) {
  const { data, error } = await getSupabaseAdminClient()
    .from("user_roles")
    .select("role,suspended_at,suspension_reason")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    const roleError = new Error("Could not verify administrator role");
    roleError.status = 503;
    roleError.code = "ADMIN_ROLE_UNAVAILABLE";
    roleError.details = error;
    throw roleError;
  }

  return {
    role: data?.role || "user",
    suspendedAt: data?.suspended_at || null,
    suspensionReason: data?.suspension_reason || null,
  };
}

async function getUserRole(userId) {
  return (await getUserAccess(userId)).role;
}

async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Authentication is required",
      });
    }

    let access = req.userAccess;

    if (!access && req.app.locals.getUserAccess) {
      access = await req.app.locals.getUserAccess(req.user.id);
    }

    if (!access && req.app.locals.getUserRole) {
      access = { role: await req.app.locals.getUserRole(req.user.id) };
    }

    access = access || (await getUserAccess(req.user.id));
    const role = access.role;

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
  getUserAccess,
  getUserRole,
  requireAdmin,
  sendForbidden,
};
