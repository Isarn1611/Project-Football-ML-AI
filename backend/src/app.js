const express = require("express");
const cors = require("cors");
const { requireAuth } = require("./middleware/requireAuth");
const { requireAdmin } = require("./middleware/requireAdmin");
const { requireActiveUser } = require("./middleware/requireActiveUser");
const { trackApiUsage } = require("./middleware/trackApiUsage");
const {
    getAdminUserUsage,
    getAdminDashboard,
    listAdminUsers,
    updateAdminUserRole,
    updateAdminUserSuspension,
} = require("./services/adminService");
const {
    listAdminPlayers,
    updateAdminPlayer,
} = require("./services/adminPlayerService");
const {
    lookupPlayersByNames,
    searchPlayers,
} = require("./services/playerService");
const {
    getMlHealth,
    getPlayerRecommendations,
} = require("./services/recommendationService");
const {
    analyzeScoutReport,
    getAiHealth,
} = require("./services/aiAnalysisService");

const app = express();
const protectedApi = [requireAuth, trackApiUsage, requireActiveUser];

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Football AI API IS RUNNING",
    });
});

app.get("/api/players/search", ...protectedApi, async (req, res, next) => {
    try {
        const result = await searchPlayers(req.query);

        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.post("/api/players/lookup", ...protectedApi, async (req, res, next) => {
    try {
        const lookupPlayers =
            req.app.locals.lookupPlayersByNames || lookupPlayersByNames;
        const result = await lookupPlayers(req.body?.names);

        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.get("/api/auth/me", ...protectedApi, async (req, res, next) => {
    try {
        const role = req.userAccess.role;

        res.json({
            user: {
                id: req.user.id,
                email: req.user.email || null,
            },
            role,
            isAdmin: role === "admin",
            suspended: false,
        });
    } catch (error) {
        next(error);
    }
});

app.get("/api/admin/health", ...protectedApi, requireAdmin, (req, res) => {
    res.json({
        status: "ok",
        role: req.userRole,
        userId: req.user.id,
    });
});

app.get("/api/admin/dashboard", ...protectedApi, requireAdmin, async (req, res, next) => {
    try {
        const loadDashboard =
            req.app.locals.getAdminDashboard || getAdminDashboard;
        const dashboard = await loadDashboard();

        res.json(dashboard);
    } catch (error) {
        next(error);
    }
});

app.get("/api/admin/users", ...protectedApi, requireAdmin, async (req, res, next) => {
    try {
        const loadUsers = req.app.locals.listAdminUsers || listAdminUsers;
        const result = await loadUsers(req.query);

        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.patch("/api/admin/users/:userId/role", ...protectedApi, requireAdmin, async (req, res, next) => {
    try {
        const changeUserRole =
            req.app.locals.updateAdminUserRole || updateAdminUserRole;
        const user = await changeUserRole(
            req.user.id,
            req.params.userId,
            req.body?.role
        );

        res.json({ user });
    } catch (error) {
        next(error);
    }
});

app.patch("/api/admin/users/:userId/suspension", ...protectedApi, requireAdmin, async (req, res, next) => {
    try {
        const changeSuspension =
            req.app.locals.updateAdminUserSuspension ||
            updateAdminUserSuspension;
        const user = await changeSuspension(
            req.user.id,
            req.params.userId,
            req.body?.suspended,
            req.body?.reason
        );

        res.json({ user });
    } catch (error) {
        next(error);
    }
});

app.get("/api/admin/users/:userId/usage", ...protectedApi, requireAdmin, async (req, res, next) => {
    try {
        const loadUsage =
            req.app.locals.getAdminUserUsage || getAdminUserUsage;
        const usage = await loadUsage(
            req.user.id,
            req.params.userId,
            req.query?.days
        );

        res.json({ usage });
    } catch (error) {
        next(error);
    }
});

app.get("/api/admin/players", ...protectedApi, requireAdmin, async (req, res, next) => {
    try {
        const loadPlayers =
            req.app.locals.listAdminPlayers || listAdminPlayers;
        const result = await loadPlayers(req.query);

        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.patch("/api/admin/players/:playerUid", ...protectedApi, requireAdmin, async (req, res, next) => {
    try {
        const changePlayer =
            req.app.locals.updateAdminPlayer || updateAdminPlayer;
        const player = await changePlayer(
            req.user.id,
            req.params.playerUid,
            req.body
        );

        res.json({ player });
    } catch (error) {
        next(error);
    }
});

app.get("/api/ml/health", async (_req, res, next) => {
    try {
        const result = await getMlHealth();
        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.post("/api/recommendations", ...protectedApi, async (req, res, next) => {
    try {
        const result = await getPlayerRecommendations(req.body?.playerName);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.get("/api/ai/health", (_req, res, next) => {
    try {
        res.json(getAiHealth());
    } catch (error) {
        next(error);
    }
});

app.post("/api/ai/analyze", ...protectedApi, async (req, res, next) => {
    try {
        const mlResult = await getPlayerRecommendations(req.body?.playerName);
        const result = await analyzeScoutReport(
            mlResult,
            req.body?.language
        );
        res.locals.aiUsage = {
            provider: result.provider,
            model: result.model,
            promptTokens: result.usage?.promptTokens,
            outputTokens: result.usage?.outputTokens,
            totalTokens: result.usage?.totalTokens,
        };
        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.use((error, req, res, _next) => {
    if (!error.status || error.status >= 500) {
        console.error(error);
    }

    res.status(error.status || 500).json({
        code: error.code,
        message: error.message || "Internal server error",
        details: error.details,
    });
});

module.exports = app;
