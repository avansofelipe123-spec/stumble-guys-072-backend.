
const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});

app.get("/", (req, res) => {
    res.json({
        name: "Stumble Guys 0.72 Backend",
        status: "online",
        version: "0.72"
    });
});

app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({
            status: "healthy",
            database: "connected"
        });
    } catch (error) {
        res.status(503).json({
            status: "unhealthy",
            database: "disconnected"
        });
    }
});

function adminAuth(req, res, next) {
    const key = process.env.ADMIN_API_KEY;

    if (!key || req.headers.authorization !== `Bearer ${key}`) {
        return res.status(401).json({
            error: "Unauthorized"
        });
    }

    next();
}

app.get("/api/players/:id", adminAuth, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM players WHERE id = $1",
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                error: "Player not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

app.patch("/api/players/:id/nick", adminAuth, async (req, res) => {
    try {
        const { nick } = req.body;

        if (typeof nick !== "string" || !nick.trim() || nick.length > 24) {
            return res.status(400).json({
                error: "Invalid nickname"
            });
        }

        const result = await pool.query(
            `UPDATE players SET nickname = $1
             WHERE id = $2 RETURNING id, nickname`,
            [nick.trim(), req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                error: "Player not found"
            });
        }

        res.json({
            success: true,
            player: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

app.post("/api/tournaments", adminAuth, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (typeof name !== "string" || !name.trim() || name.length > 80) {
            return res.status(400).json({
                error: "Invalid tournament name"
            });
        }

        const result = await pool.query(
            `INSERT INTO tournaments (name, description)
             VALUES ($1, $2) RETURNING *`,
            [name.trim(), description || ""]
        );

        res.status(201).json({
            success: true,
            tournament: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

app.get("/api/tournaments", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM tournaments ORDER BY id DESC"
        );

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on port ${PORT}`);
});
