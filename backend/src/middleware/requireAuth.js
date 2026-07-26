const { getSupabaseAuthClient } = require("../config/supabase");

function getBearerToken(authorizationHeader) {
  const match = String(authorizationHeader || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function sendUnauthorized(res, message = "Authentication is required") {
  return res.status(401).json({
    code: "UNAUTHENTICATED",
    message,
  });
}

async function verifySupabaseUser(token) {
  const {
    data: { user },
    error,
  } = await getSupabaseAuthClient().auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req.get("authorization"));
    if (!token) {
      return sendUnauthorized(res);
    }

    const verifyUser = req.app.locals.verifySupabaseUser || verifySupabaseUser;
    const user = await verifyUser(token);

    if (!user) {
      return sendUnauthorized(res, "Invalid or expired session");
    }

    req.accessToken = token;
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getBearerToken,
  requireAuth,
  verifySupabaseUser,
};
