const { getUserAccess } = require("./requireAdmin");

async function requireActiveUser(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Authentication is required",
      });
    }

    const readUserAccess = req.app.locals.getUserAccess || getUserAccess;
    const access = await readUserAccess(req.user.id);

    if (access.suspendedAt) {
      return res.status(403).json({
        code: "ACCOUNT_SUSPENDED",
        message: "This account has been suspended",
        details: {
          reason: access.suspensionReason || null,
        },
      });
    }

    req.userAccess = access;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requireActiveUser,
};
