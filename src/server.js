
const express = require("express");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const {
    generateAccountToken,
    hashToken,
    validateToken
} = require("./auth");

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

// INICIALIZAÇÃO DO BANCO
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

// AUTENTICAÇÃO DOS JOGADORES
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

// AUTORIZAÇÃO ADMINISTRATIVA
function adminAuth(req, res, next) {
    const key = process.env.ADMIN_API_KEY;

    if (!key || req.headers.authorization !== `Bearer ${key}`) {
        return res.status(401).json({
            error: "Unauthorized"
        });
    }

    next();
}

// PÁGINA INICIAL
app.get("/", (req, res) => {
    res.json({
        name: "Stumble Guys 0.72 Backend",
        status: "online",
        version: "0.72"
    });
});

// VERIFICAR BANCO
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

// CADASTRO DE CONTA
app.post("/api/auth/register", async (req, res) => {
    try {
        const token = generateAccountToken();
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
                    token,
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

// LOGIN AUTOMÁTICO
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

// DADOS DA CONTA AUTENTICADA
app.get("/api/me", accountAuth, (req, res) => {
    res.json({
        success: true,
        player: req.player
    });
});

// CONSULTAR JOGADOR (ADMIN)
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

        res.status(500).json({
            error: "Database error"
        });
    }
});

// ALTERAR NICKNAME (ADMIN)
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
        console.error("Nickname update error:", error);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// CRIAR TORNEIO (ADMIN)
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
        console.error("Tournament creation error:", error);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// LISTAR TORNEIOS
app.get("/api/tournaments", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM tournaments ORDER BY id DESC"
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Tournament list error:", error);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// INSCREVER JOGADOR EM UM TORNEIO
app.post(
    "/api/tournaments/:id/join",
    accountAuth,
    async (req, res) => {
        const tournamentId = req.params.id;

        if (!/^[1-9]\d*$/.test(tournamentId)) {
            return res.status(400).json({
                error: "Invalid tournament ID"
            });
        }

        const client = await pool.connect();
        let transactionStarted = false;

        try {
            await client.query("BEGIN");
            transactionStarted = true;

            // Bloqueia este torneio durante a inscrição.
            const tournamentResult = await client.query(
                `SELECT *
                 FROM tournaments
                 WHERE id = $1
                 FOR UPDATE`,
                [tournamentId]
            );

            if (!tournamentResult.rows.length) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(404).json({
                    error: "Tournament not found"
                });
            }

            const tournament = tournamentResult.rows[0];

            if (tournament.status !== "pending") {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(409).json({
                    error: "Tournament is not accepting registrations"
                });
            }

            if (
                tournament.registration_ends_at &&
                new Date(tournament.registration_ends_at) <= new Date()
            ) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(409).json({
                    error: "Tournament registrations are closed"
                });
            }

            if (
                tournament.starts_at &&
                new Date(tournament.starts_at) <= new Date()
            ) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(409).json({
                    error: "Tournament has already started"
                });
            }

            // Impede inscrição duplicada.
            const existing = await client.query(
                `SELECT id
                 FROM tournament_players
                 WHERE tournament_id = $1
                   AND player_id = $2`,
                [tournamentId, req.player.id]
            );

            if (existing.rows.length) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(409).json({
                    error: "You are already registered for this tournament"
                });
            }

            // Verifica vagas disponíveis.
            const countResult = await client.query(
                `SELECT COUNT(*) AS total
                 FROM tournament_players
                 WHERE tournament_id = $1`,
                [tournamentId]
            );

            const currentPlayers = Number(countResult.rows[0].total);

            if (currentPlayers >= tournament.max_players) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(409).json({
                    error: "Tournament is full"
                });
            }

            // Desconta as gemas somente se houver saldo suficiente.
            const entryCost = tournament.entry_cost || 0;

            const balanceResult = await client.query(
                `UPDATE players
                 SET gems = gems - $1,
                     updated_at = NOW()
                 WHERE id = $2
                   AND gems >= $1
                 RETURNING id, nickname, gems`,
                [entryCost, req.player.id]
            );

            if (!balanceResult.rows.length) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(402).json({
                    error: "Not enough gems"
                });
            }

            // Registra a inscrição.
            const registrationResult = await client.query(
                `INSERT INTO tournament_players
                 (tournament_id, player_id)
                 VALUES ($1, $2)
                 RETURNING id, tournament_id, player_id, joined_at`,
                [tournamentId, req.player.id]
            );

            await client.query("COMMIT");
            transactionStarted = false;

            return res.status(201).json({
                success: true,
                message: "Successfully registered for tournament",
                registration: registrationResult.rows[0],
                tournament: {
                    id: tournament.id,
                    name: tournament.name
                },
                player: {
                    id: balanceResult.rows[0].id,
                    nickname: balanceResult.rows[0].nickname,
                    gems: balanceResult.rows[0].gems
                },
                spots: {
                    occupied: currentPlayers + 1,
                    maximum: tournament.max_players
                }
            });

        } catch (error) {
            if (transactionStarted) {
                await client.query("ROLLBACK").catch(() => {});
            }

            if (error.code === "23505") {
                return res.status(409).json({
                    error: "You are already registered for this tournament"
                });
            }

            console.error("Tournament registration error:", error);

            return res.status(500).json({
                error: "Could not register for tournament"
            });

        } finally {
            client.release();
        }
    }
);

// INICIAR SERVIDOR E BOT DO DISCORD
async function startServer() {
    try {
        await initializeDatabase();

        if (process.env.DISCORD_BOT_TOKEN) {
            await startDiscordBot(pool);
            console.log("Integração com Discord iniciada!");
        } else {
            console.log("Bot Discord ainda não configurado.");
        }

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Backend running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Erro ao iniciar o backend:", error);
        process.exit(1);
    }
}

startServer();
