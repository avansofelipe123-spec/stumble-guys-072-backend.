
const express = require("express");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const {
    generateAccountToken,
    hashToken,
    validateToken
} = require("./auth");

const app = express();
app.use(express.json({ limit: "32kb" }));

const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});

// Inicialização do banco
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

// Autenticação dos jogadores
async function accountAuth(req, res, next) {
    try {
        const authorization = req.headers.authorization || "";
        const token = authorization.startsWith("Bearer ")
            ? authorization.slice(7)
            : "";

        if (!validateToken(token)) {
            return res.status(401).json({
                error: "Invalid account token"
            });
        }

        const result = await pool.query(
            `SELECT id, nickname, tag_number, gems, tokens
             FROM players
             WHERE account_key = $1 AND is_bot = FALSE`,
            [hashToken(token)]
        );

        if (!result.rows.length) {
            return res.status(401).json({
                error: "Account not found"
            });
        }

        req.player = result.rows[0];
        next();
    } catch (error) {
        console.error("Authentication error:", error);
        res.status(500).json({
            error: "Authentication failed"
        });
    }
}

// Autorização administrativa
function adminAuth(req, res, next) {
    const key = process.env.ADMIN_API_KEY;

    if (!key || req.headers.authorization !== `Bearer ${key}`) {
        return res.status(401).json({
            error: "Unauthorized"
        });
    }

    next();
}

// Página inicial
app.get("/", (req, res) => {
    res.json({
        name: "Stumble Guys 0.72 Backend",
        status: "online",
        version: "0.72"
    });
});

// Verificar banco
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

// Cadastro de conta
app.post("/api/auth/register", async (req, res) => {
    let token;

    try {
        token = generateAccountToken();
        const accountKey = hashToken(token);

        for (let attempt = 0; attempt < 30; attempt++) {
            const tagNumber = require("crypto").randomInt(1000, 10000);

            try {
                const result = await pool.query(
                    `INSERT INTO players
                     (account_key, nickname, tag_number, gems, tokens)
                     VALUES ($1, '.GG/SGxenon', $2, 100000, 5000)
                     RETURNING id, nickname, tag_number, gems, tokens`,
                    [accountKey, tagNumber]
                );

                return res.status(201).json({
                    success: true,
                    message: "Account created",
                    token: token,
                    player: result.rows[0]
                });
            } catch (error) {
                if (error.code === "23505") {
                    continue;
                }

                throw error;
            }
        }

        return res.status(503).json({
            error: "Could not generate a unique player number"
        });
    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            error: "Account registration failed"
        });
    }
});

// Login automático
app.post("/api/auth/login", async (req, res) => {
    try {
        const { token } = req.body;

        if (!validateToken(token)) {
            return res.status(400).json({
                error: "Invalid token"
            });
        }

        const result = await pool.query(
            `SELECT id, nickname, tag_number, gems, tokens
             FROM players
             WHERE account_key = $1 AND is_bot = FALSE`,
            [hashToken(token)]
        );

        if (!result.rows.length) {
            return res.status(401).json({
                error: "Account not found"
            });
        }

        res.json({
            success: true,
            player: result.rows[0]
        });
    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            error: "Login failed"
        });
    }
});

// Dados da conta autenticada
app.get("/api/me", accountAuth, (req, res) => {
    res.json({
        success: true,
        player: req.player
    });
});

// Consultar jogador (admin)
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

// Alterar nickname (admin por enquanto)
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

// Criar torneio de gemas (admin por enquanto)
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

// Listar torneios
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

// Iniciar servidor
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
