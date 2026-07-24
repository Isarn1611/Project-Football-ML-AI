const express = require("express");
const cors = require("cors");
const { searchPlayersByName } = require("./services/playerService");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Football AI API IS RUNNING",
    });
});

app.get("/api/players/search", async (req, res, next) => {
    try {
        const { name, limit } = req.query;
        const result = await searchPlayersByName(name, limit);

        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.use((error, req, res, _next) => {
    console.error(error);

    res.status(error.status || 500).json({
        message: error.message || "Internal server error",
        details: error.details,
    });
});

module.exports = app;
