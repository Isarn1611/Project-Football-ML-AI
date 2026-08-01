const express = require("express");
const cors = require("cors");
const { requireAuth } = require("./middleware/requireAuth");
const {
    getUserRole,
    requireAdmin,
} = require("./middleware/requireAdmin");
const { getAdminDashboard } = require("./services/adminService");
const { searchPlayers } = require("./services/playerService");
const {
    getMlHealth,
    getPlayerRecommendations,
} = require("./services/recommendationService");
const {
    analyzeScoutReport,
    getAiHealth,
} = require("./services/aiAnalysisService");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Football AI API IS RUNNING",
    });
});

app.get("/api/players/search", requireAuth, async (req, res, next) => {
    try {
        const result = await searchPlayers(req.query);

        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.get("/api/auth/me", requireAuth, async (req, res, next) => {
    try {
        const readUserRole = req.app.locals.getUserRole || getUserRole;
        const role = await readUserRole(req.user.id);

        res.json({
            user: {
                id: req.user.id,
                email: req.user.email || null,
            },
            role,
            isAdmin: role === "admin",
        });
    } catch (error) {
        next(error);
    }
});

app.get("/api/admin/health", requireAuth, requireAdmin, (req, res) => {
    res.json({
        status: "ok",
        role: req.userRole,
        userId: req.user.id,
    });
});

app.get("/api/admin/dashboard", requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const loadDashboard =
            req.app.locals.getAdminDashboard || getAdminDashboard;
        const dashboard = await loadDashboard();

        res.json(dashboard);
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

app.post("/api/recommendations", requireAuth, async (req, res, next) => {
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

app.post("/api/ai/analyze", requireAuth, async (req, res, next) => {
    try {
        const mlResult = await getPlayerRecommendations(req.body?.playerName);
        const result = await analyzeScoutReport(
            mlResult,
            req.body?.language
        );
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
