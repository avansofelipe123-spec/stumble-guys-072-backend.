
const express = require("express");
const { Pool } = require("pg");
const { startDiscordBot } = require("./discord");

const app = express();
app.use(express.json({ limit: "32kb" }));

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
        console.error("Health check error:", error);

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
        console.error("Player lookup error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

app.patch("/api/players/:id/nick", adminAuth, async (req, res) => {
    try {
        const { nick } = req.body;

        if (
            typeof nick !== "string" ||
            nick.trim().length < 4 ||
            nick.trim().length > 20
        ) {
            return res.status(400).json({
                error: "Nickname must have between 4 and 20 characters"
            });
        }

        const result = await pool.query(
            `UPDATE players
             SET nickname = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, nickname`,
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
        console.error("Nickname update error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

app.post("/api/tournaments", adminAuth, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.trim().length > 80
        ) {
            return res.status(400).json({
                error: "Invalid tournament name"
            });
        }

        const result = await pool.query(
            `INSERT INTO tournaments (
                tournament_type,
                name,
                description,
                max_players
            )
            VALUES ('gems', $1, $2, 32)
            RETURNING *`,
            [name.trim(), description || ""]
        );

        res.status(201).json({
            success: true,
            tournament: result.rows[0]
        });
    } catch (error) {
        console.error("Tournament creation error:", error);
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
        console.error("Tournament listing error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

async function startServer() {
    try {
        await pool.query("SELECT 1");
        console.log("Database connected!");

        if (process.env.DISCORD_BOT_TOKEN) {
            await startDiscordBot(pool);
            console.log("Discord integration started!");
        } else {
            console.log("Discord bot token not configured.");
        }

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Backend running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Startup error:", error);
        process.exit(1);
    }
}

startServer();
