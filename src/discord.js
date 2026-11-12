
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

const discord = new Client({
    intents: [GatewayIntentBits.Guilds]
});

let pool = null;

// ADICIONAR MAPAS
function addMapOptions(command) {
    for (let i = 1; i <= 6; i++) {
        command.addStringOption(option =>
            option
                .setName(`mapa${i}`)
                .setDescription(`Mapa da rodada ${i}`)
                .setRequired(false)
        );
    }

    return command;
}

// /create - TORNEIO CLÁSSICO
const classicCommand = addMapOptions(
    new SlashCommandBuilder()
        .setName("create")
        .setDescription("Criar torneio clássico")
        .addStringOption(o =>
            o.setName("banner")
                .setDescription("Link do banner")
                .setRequired(true))
        .addStringOption(o =>
            o.setName("nome")
                .setDescription("Nome do torneio")
                .setRequired(true))
        .addIntegerOption(o =>
            o.setName("entrada")
                .setDescription("Custo de entrada em gemas")
                .setMinValue(0)
                .setRequired(true))
        .addIntegerOption(o =>
            o.setName("premio")
                .setDescription("Prêmio do vencedor em gemas")
                .setMinValue(0)
                .setRequired(true))
        .addIntegerOption(o =>
            o.setName("rodadas")
                .setDescription("Quantidade de rodadas")
                .setMinValue(1)
                .setMaxValue(6)
                .setRequired(true))
        .addIntegerOption(o =>
            o.setName("participantes")
                .setDescription("Número máximo de jogadores")
                .setMinValue(2)
                .setRequired(true))
);

// /t create - TORNEIO DE GEMAS
const gemsCommand = new SlashCommandBuilder()
    .setName("t")
    .setDescription("Sistema de torneios de gemas")
    .addSubcommand(sub => {
        let command = sub
            .setName("create")
            .setDescription("Criar torneio de gemas")

            .addStringOption(o =>
                o.setName("nome")
                    .setDescription("Nome do torneio")
                    .setRequired(true))

            .addIntegerOption(o =>
                o.setName("participantes")
                    .setDescription("Máximo de participantes")
                    .setMinValue(2)
                    .setRequired(true))

            .addIntegerOption(o =>
                o.setName("inicio")
                    .setDescription("Minutos até o início")
                    .setMinValue(1)
                    .setRequired(true))

            .addIntegerOption(o =>
                o.setName("inscricoes")
                    .setDescription("Duração das inscrições em minutos")
                    .setMinValue(1)
                    .setRequired(true))

            .addIntegerOption(o =>
                o.setName("entrada")
                    .setDescription("Custo da inscrição em gemas")
                    .setMinValue(0)
                    .setRequired(true))

            .addStringOption(o =>
                o.setName("modo")
                    .setDescription("Modo do torneio")
                    .setRequired(true)
                    .addChoices(
                        { name: "Solo", value: "solo" },
                        { name: "Duos", value: "duos" }
                    ))

            .addIntegerOption(o =>
                o.setName("top1")
                    .setDescription("Prêmio do primeiro lugar")
                    .setMinValue(0)
                    .setRequired(true))

            .addIntegerOption(o =>
                o.setName("rodadas")
                    .setDescription("Quantidade de rodadas")
                    .setMinValue(1)
                    .setMaxValue(6)
                    .setRequired(true))

            .addStringOption(o =>
                o.setName("banner")
                    .setDescription("Link do banner")
                    .setRequired(false));

        for (let i = 2; i <= 10; i++) {
            command.addIntegerOption(o =>
                o.setName(`top${i}`)
                    .setDescription(`Prêmio do ${i}º lugar`)
                    .setMinValue(0)
                    .setRequired(false)
            );
        }

        return addMapOptions(command);
    });

// /player nick
const playerCommand = new SlashCommandBuilder()
    .setName("player")
    .setDescription("Gerenciar jogadores")
    .addSubcommand(sub =>
        sub.setName("nick")
            .setDescription("Alterar nickname")
            .addIntegerOption(o =>
                o.setName("id")
                    .setDescription("ID do jogador")
                    .setRequired(true))
            .addStringOption(o =>
                o.setName("nickname")
                    .setDescription("Novo nickname")
                    .setRequired(true))
    );

// REGISTRAR COMANDOS
const commands = [
    classicCommand.toJSON(),
    gemsCommand.toJSON(),
    playerCommand.toJSON()
];

async function registerCommands() {
    const rest = new REST({ version: "10" })
        .setToken(process.env.DISCORD_BOT_TOKEN);

    await rest.put(
        Routes.applicationGuildCommands(
            process.env.DISCORD_CLIENT_ID,
            process.env.DISCORD_GUILD_ID
        ),
        { body: commands }
    );

    console.log("Comandos Slash registrados!");
}

// VERIFICAR PROPRIETÁRIO E CARGOS
async function getPermissions(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
        return {
            isOwner: false,
            isAuthorized: false
        };
    }

    const guild = interaction.guild;

    const isServerOwner =
        interaction.user.id === guild.ownerId;

    const member = await guild.members.fetch(
        interaction.user.id
    );

    const isOwner =
        isServerOwner ||
        (
            !!process.env.DISCORD_OWNER_ROLE_ID &&
            member.roles.cache.has(
                process.env.DISCORD_OWNER_ROLE_ID
            )
        );

    const isAuthorized =
        !!process.env.DISCORD_AUTHORIZED_ROLE_ID &&
        member.roles.cache.has(
            process.env.DISCORD_AUTHORIZED_ROLE_ID
        );

    return {
        isOwner,
        isAuthorized
    };
}

// VALIDAR MAPAS
function collectMaps(interaction, rounds) {
    const maps = [];

    for (let i = 1; i <= 6; i++) {
        const map = interaction.options
            .getString(`mapa${i}`);

        if (i <= rounds && !map) {
            return {
                error: `Informe o mapa da rodada ${i}.`
            };
        }

        if (i > rounds && map) {
            return {
                error: `Você escolheu ${rounds} rodadas. Não informe o mapa ${i}.`
            };
        }

        if (map) {
            maps.push(map.trim());
        }
    }

    return { maps };
}

// VALIDAR LINK DO BANNER
function validBanner(url) {
    try {
        const parsed = new URL(url);

        return (
            parsed.protocol === "https:" ||
            parsed.protocol === "http:"
        );
    } catch {
        return false;
    }
}

// /create - SALVAR TORNEIO CLÁSSICO
async function handleClassic(interaction) {
    const rounds = interaction.options.getInteger("rodadas");
    const result = collectMaps(interaction, rounds);

    if (result.error) {
        return interaction.reply({
            content: result.error,
            ephemeral: true
        });
    }

    const name = interaction.options.getString("nome").trim();
    const banner = interaction.options.getString("banner");
    const entry = interaction.options.getInteger("entrada");
    const prize = interaction.options.getInteger("premio");
    const participants = interaction.options.getInteger("participantes");

    if (!name || name.length > 80) {
        return interaction.reply({
            content: "O nome deve ter entre 1 e 80 caracteres.",
            ephemeral: true
        });
    }

    if (!validBanner(banner)) {
        return interaction.reply({
            content: "Informe um link válido para o banner.",
            ephemeral: true
        });
    }

    await interaction.deferReply({ ephemeral: true });

    const rewards = {
        "1": prize
    };

    const saved = await pool.query(
        `INSERT INTO tournaments (
            tournament_type,
            name,
            image_url,
            max_players,
            selected_maps,
            rounds,
            entry_cost,
            first_place_gems,
            position_rewards,
            status
        )
        VALUES (
            'classic',
            $1,
            $2,
            $3,
            $4::jsonb,
            $5,
            $6,
            $7,
            $8::jsonb,
            'pending'
        )
        RETURNING id, name, status`,
        [
            name,
            banner,
            participants,
            JSON.stringify(result.maps),
            rounds,
            entry,
            prize,
            JSON.stringify(rewards)
        ]
    );

    const tournament = saved.rows[0];

    await interaction.editReply({
        content:
            `**Torneio clássico criado e salvo!**\n\n` +
            `**ID:** ${tournament.id}\n` +
            `**Nome:** ${tournament.name}\n` +
            `**Banner:** ${banner}\n` +
            `**Entrada:** ${entry} gemas\n` +
            `**Prêmio:** ${prize} gemas\n` +
            `**Participantes:** ${participants}\n` +
            `**Rodadas:** ${rounds}\n\n` +
            `**Mapas:**\n` +
            result.maps.map((map, i) =>
                `**Rodada ${i + 1}:** ${map}`
            ).join("\n") +
            `\n\n**Status:** Pendente`
    });
}

// /t create - SALVAR TORNEIO DE GEMAS
async function handleGems(interaction) {
    const rounds = interaction.options.getInteger("rodadas");
    const result = collectMaps(interaction, rounds);

    if (result.error) {
        return interaction.reply({
            content: result.error,
            ephemeral: true
        });
    }

    const name = interaction.options.getString("nome").trim();
    const banner = interaction.options.getString("banner");
    const participants = interaction.options.getInteger("participantes");
    const start = interaction.options.getInteger("inicio");
    const registration = interaction.options.getInteger("inscricoes");
    const entry = interaction.options.getInteger("entrada");
    const mode = interaction.options.getString("modo");

    if (!name || name.length > 80) {
        return interaction.reply({
            content: "O nome deve ter entre 1 e 80 caracteres.",
            ephemeral: true
        });
    }

    if (banner && !validBanner(banner)) {
        return interaction.reply({
            content: "Informe um link válido para o banner.",
            ephemeral: true
        });
    }

    if (registration > start) {
        return interaction.reply({
            content: "O tempo de inscrições não pode ser maior que o tempo até o início do torneio.",
            ephemeral: true
        });
    }

    const rewards = {};

    for (let i = 1; i <= 10; i++) {
        const reward = interaction.options.getInteger(`top${i}`);

        if (reward !== null) {
            rewards[String(i)] = reward;
        }
    }

    const startsAt = new Date(
        Date.now() + start * 60 * 1000
    );

    const registrationEndsAt = new Date(
        Date.now() + registration * 60 * 1000
    );

    await interaction.deferReply({ ephemeral: true });

    const saved = await pool.query(
        `INSERT INTO tournaments (
            tournament_type,
            name,
            image_url,
            max_players,
            selected_maps,
            rounds,
            team_mode,
            starts_at,
            registration_ends_at,
            entry_cost,
            first_place_gems,
            position_rewards,
            status
        )
        VALUES (
            'gems',
            $1,
            $2,
            $3,
            $4::jsonb,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11::jsonb,
            'pending'
        )
        RETURNING id, name, status, starts_at, registration_ends_at`,
        [
            name,
            banner || null,
            participants,
            JSON.stringify(result.maps),
            rounds,
            mode,
            startsAt,
            registrationEndsAt,
            entry,
            rewards["1"],
            JSON.stringify(rewards)
        ]
    );

    const tournament = saved.rows[0];

    const rewardText = Object.entries(rewards)
        .map(([position, amount]) =>
            `**Top ${position}:** ${amount} gemas`
        )
        .join("\n");

    await interaction.editReply({
        content:
            `**Torneio de gemas criado e salvo!**\n\n` +
            `**ID:** ${tournament.id}\n` +
            `**Nome:** ${tournament.name}\n` +
            `**Banner:** ${banner || "Não informado"}\n` +
            `**Participantes:** ${participants}\n` +
            `**Início:** ${start} minutos\n` +
            `**Inscrições:** ${registration} minutos\n` +
            `**Entrada:** ${entry} gemas\n` +
            `**Modo:** ${mode}\n` +
            `**Rodadas:** ${rounds}\n\n` +
            `**Premiações:**\n${rewardText}\n\n` +
            `**Mapas:**\n` +
            result.maps.map((map, i) =>
                `**Rodada ${i + 1}:** ${map}`
            ).join("\n") +
            `\n\n**Status:** Pendente`
    });
}

// /player nick - ALTERAR NICKNAME NO BANCO
async function handlePlayerNick(interaction) {
    const playerId = interaction.options.getInteger("id");
    const nickname = interaction.options
        .getString("nickname")
        .trim();

    if (nickname.length < 4 || nickname.length > 20) {
        return interaction.reply({
            content: "O nickname deve ter entre 4 e 20 caracteres.",
            ephemeral: true
        });
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await pool.query(
        `UPDATE players
         SET nickname = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, nickname`,
        [nickname, playerId]
    );

    if (!result.rows.length) {
        return interaction.editReply({
            content: `Nenhum jogador encontrado com o ID ${playerId}.`
        });
    }

    const player = result.rows[0];

    await interaction.editReply({
        content:
            `**Nickname atualizado!**\n\n` +
            `**ID do jogador:** ${player.id}\n` +
            `**Novo nickname:** ${player.nickname}`
    });
}

// RECEBER COMANDOS
discord.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        const {
            isOwner,
            isAuthorized
        } = await getPermissions(interaction);

        // /create: SOMENTE DONO
        if (interaction.commandName === "create") {
            if (!isOwner) {
                return interaction.reply({
                    content: "Somente o Dono pode criar torneios clássicos.",
                    ephemeral: true
                });
            }

            return await handleClassic(interaction);
        }

        // /t create: DONO OU AUTORIZADO
        if (interaction.commandName === "t") {
            if (!isOwner && !isAuthorized) {
                return interaction.reply({
                    content: "Você não tem permissão para criar torneios de gemas.",
                    ephemeral: true
                });
            }

            if (interaction.options.getSubcommand() === "create") {
                return await handleGems(interaction);
            }
        }

        // /player nick: SOMENTE DONO
        if (interaction.commandName === "player") {
            if (!isOwner) {
                return interaction.reply({
                    content: "Somente o Dono pode alterar nicknames.",
                    ephemeral: true
                });
            }

            if (interaction.options.getSubcommand() === "nick") {
                return await handlePlayerNick(interaction);
            }
        }

    } catch (error) {
        console.error("Erro ao executar comando:", error);

        const response = {
            content: "Ocorreu um erro ao executar o comando. Verifique os logs do backend.",
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(response).catch(() => {});
        } else {
            await interaction.reply(response).catch(() => {});
        }
    }
});

// INICIAR BOT
async function startDiscordBot(databasePool) {
    if (
        !process.env.DISCORD_BOT_TOKEN ||
        !process.env.DISCORD_CLIENT_ID ||
        !process.env.DISCORD_GUILD_ID
    ) {
        throw new Error("Configurações do Discord incompletas.");
    }

    if (!databasePool || typeof databasePool.query !== "function") {
        throw new Error("Conexão com o banco de dados não foi fornecida.");
    }

    pool = databasePool;

    await discord.login(process.env.DISCORD_BOT_TOKEN);
    await registerCommands();

    console.log(`Bot conectado: ${discord.user.tag}`);
    console.log("Integração com PostgreSQL iniciada!");
}

module.exports = {
    startDiscordBot
};
