
const express = require("express");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});

// Executa automaticamente o schema.sql
async function initializeDatabase() {
    const schemaPath = path.join(
        __dirname,
        "..",
        "database",
        "schema.sql"
    );

    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);

    console.log("Banco de dados inicializado!");
}

function adminAuth(req, res, next) {
    const key = process.env.ADMIN_API_KEY;

    if (!key || req.headers.authorization !== `Bearer ${key}`) {
        return res.status(401).json({
            error: "Unauthorized"
        });
    }

    next();
}

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
        res.status(500).json({
            error: "Database error"
        });
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
                error: "Nickname must have 4 to 20 characters"
            });
        }

        const result = await pool.query(
            `UPDATE players
             SET nickname = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, nickname, tag_number`,
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
        res.status(500).json({
            error: "Database error"
        });
    }
});

app.post("/api/tournaments", adminAuth, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.length > 80
        ) {
            return res.status(400).json({
                error: "Invalid tournament name"
            });
        }

        const result = await pool.query(
            `INSERT INTO tournaments
             (tournament_type, name, description, max_players)
             VALUES ('gems', $1, $2, 32)
             RETURNING *`,
            [name.trim(), description || ""]
        );

        res.status(201).json({
            success: true,
            tournament: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            error: "Database error"
        });
    }
});

app.get("/api/tournaments", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM tournaments ORDER BY id DESC"
        );

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({
            error: "Database error"
        });
    }
});

// Só inicia o servidor depois de preparar o banco
async function startServer() {
    try {
        await initializeDatabase();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Backend running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Erro ao inicializar o banco:", error);
        process.exit(1);
    }
}

startServer();
