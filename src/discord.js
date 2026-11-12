
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
                .setDescription("Custo de entrada")
                .setMinValue(0)
                .setRequired(true))
        .addIntegerOption(o =>
            o.setName("premio")
                .setDescription("Prêmio do vencedor")
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

        // TOP 2 ATÉ TOP 10
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

    // O proprietário do servidor é reconhecido automaticamente
    const isServerOwner =
        interaction.user.id === guild.ownerId;

    // Buscar os cargos atuais do membro
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
        const map = interaction.options.getString(`mapa${i}`);

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

        if (map) maps.push(map);
    }

    return { maps };
}

// /create - TORNEIO CLÁSSICO
async function handleClassic(interaction) {
    const rounds = interaction.options.getInteger("rodadas");
    const result = collectMaps(interaction, rounds);

    if (result.error) {
        return interaction.reply({
            content: result.error,
            ephemeral: true
        });
    }

    const name = interaction.options.getString("nome");
    const banner = interaction.options.getString("banner");
    const entry = interaction.options.getInteger("entrada");
    const prize = interaction.options.getInteger("premio");
    const participants = interaction.options.getInteger("participantes");

    return interaction.reply({
        content:
            `**Torneio clássico configurado!**\n\n` +
            `**Nome:** ${name}\n` +
            `**Banner:** ${banner}\n` +
            `**Entrada:** ${entry}\n` +
            `**Prêmio:** ${prize}\n` +
            `**Participantes:** ${participants}\n` +
            `**Rodadas:** ${rounds}\n\n` +
            result.maps.map((map, i) =>
                `**Rodada ${i + 1}:** ${map}`
            ).join("\n") +
            `\n\nConfiguração recebida. Ainda falta conectar ao banco de dados.`,
        ephemeral: true
    });
}

// /t create - TORNEIO DE GEMAS
async function handleGems(interaction) {
    const rounds = interaction.options.getInteger("rodadas");
    const result = collectMaps(interaction, rounds);

    if (result.error) {
        return interaction.reply({
            content: result.error,
            ephemeral: true
        });
    }

    const name = interaction.options.getString("nome");
    const banner = interaction.options.getString("banner");
    const participants = interaction.options.getInteger("participantes");
    const start = interaction.options.getInteger("inicio");
    const registration = interaction.options.getInteger("inscricoes");
    const entry = interaction.options.getInteger("entrada");
    const mode = interaction.options.getString("modo");

    const rewards = [];

    for (let i = 1; i <= 10; i++) {
        const reward = interaction.options.getInteger(`top${i}`);

        if (reward !== null) {
            rewards.push(`**Top ${i}:** ${reward} gemas`);
        }
    }

    return interaction.reply({
        content:
            `**Torneio de gemas configurado!**\n\n` +
            `**Nome:** ${name}\n` +
            `**Banner:** ${banner ?? "Não informado"}\n` +
            `**Participantes:** ${participants}\n` +
            `**Início:** ${start} minutos\n` +
            `**Inscrições:** ${registration} minutos\n` +
            `**Entrada:** ${entry} gemas\n` +
            `**Modo:** ${mode}\n` +
            `**Rodadas:** ${rounds}\n\n` +
            `**Premiações:**\n${rewards.join("\n")}\n\n` +
            `**Mapas:**\n` +
            result.maps.map((map, i) =>
                `**Rodada ${i + 1}:** ${map}`
            ).join("\n") +
            `\n\nConfiguração recebida. Ainda falta conectar ao banco de dados.`,
        ephemeral: true
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

            return interaction.reply({
                content: "Comando recebido. A alteração será conectada ao banco na próxima etapa.",
                ephemeral: true
            });
        }

    } catch (error) {
        console.error("Erro ao executar comando:", error);

        const response = {
            content: "Ocorreu um erro ao verificar suas permissões ou executar o comando.",
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
async function startDiscordBot() {
    if (
        !process.env.DISCORD_BOT_TOKEN ||
        !process.env.DISCORD_CLIENT_ID ||
        !process.env.DISCORD_GUILD_ID
    ) {
        throw new Error("Configurações do Discord incompletas.");
    }

    await discord.login(process.env.DISCORD_BOT_TOKEN);
    await registerCommands();

    console.log(`Bot conectado: ${discord.user.tag}`);
}

module.exports = {
    startDiscordBot
};