
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

// COMANDOS DO SERVIDOR
const commands = [
    // TORNEIO ANTIGO
    new SlashCommandBuilder()
        .setName("create")
        .setDescription("Criar torneio clássico antigo")
        .addStringOption(o =>
            o.setName("nome")
                .setDescription("Nome do torneio")
                .setRequired(true))
        .addStringOption(o =>
            o.setName("imagem")
                .setDescription("Link do banner")
                .setRequired(false))
        .addIntegerOption(o =>
            o.setName("duracao")
                .setDescription("Duração em dias")
                .setRequired(true))
        .addStringOption(o =>
            o.setName("mapa")
                .setDescription("Mapa do torneio")
                .setRequired(true))
        .addIntegerOption(o =>
            o.setName("premio")
                .setDescription("Prêmio do torneio")
                .setRequired(true))
        .addIntegerOption(o =>
            o.setName("entrada")
                .setDescription("Custo de entrada")
                .setRequired(true)),

    // GRUPO DE TORNEIOS ATUAIS
    new SlashCommandBuilder()
        .setName("t")
        .setDescription("Sistema de torneios atuais")
        .addSubcommand(sub =>
            sub.setName("create")
                .setDescription("Criar torneio de gemas")
                .addStringOption(o =>
                    o.setName("nome")
                        .setDescription("Nome do torneio")
                        .setRequired(true))
                .addStringOption(o =>
                    o.setName("banner")
                        .setDescription("Link do banner")
                        .setRequired(false))
                .addIntegerOption(o =>
                    o.setName("participantes")
                        .setDescription("Máximo de participantes")
                        .setRequired(true))
                .addStringOption(o =>
                    o.setName("mapas")
                        .setDescription("Mapas separados por vírgula")
                        .setRequired(true))
                .addIntegerOption(o =>
                    o.setName("rodadas")
                        .setDescription("Quantidade de rodadas")
                        .setRequired(true))
                .addStringOption(o =>
                    o.setName("modo")
                        .setDescription("Modo do torneio")
                        .setRequired(true)
                        .addChoices(
                            { name: "Solo", value: "solo" },
                            { name: "Duos", value: "duos" }
                        ))
                .addStringOption(o =>
                    o.setName("premios")
                        .setDescription("Premiações por colocação")
                        .setRequired(true))
                .addStringOption(o =>
                    o.setName("inicio")
                        .setDescription("Minutos até começar ou data e horário")
                        .setRequired(true))),

    // ALTERAR NICKNAME
    new SlashCommandBuilder()
        .setName("player")
        .setDescription("Gerenciar jogadores")
        .addSubcommand(sub =>
            sub.setName("nick")
                .setDescription("Alterar nickname de um jogador")
                .addIntegerOption(o =>
                    o.setName("id")
                        .setDescription("ID do jogador")
                        .setRequired(true))
                .addStringOption(o =>
                    o.setName("nickname")
                        .setDescription("Novo nickname")
                        .setRequired(true)))
].map(command => command.toJSON());

// REGISTRAR COMANDOS NO SERVIDOR
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

// VERIFICAR CARGOS
async function checkRole(userId, roleId) {
    if (!roleId) return false;

    const guild = await discord.guilds.fetch(
        process.env.DISCORD_GUILD_ID
    );

    const member = await guild.members.fetch(userId);

    return member.roles.cache.has(roleId);
}

// RECEBER COMANDOS
discord.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        const isOwner = await checkRole(
            interaction.user.id,
            process.env.DISCORD_OWNER_ROLE_ID
        );

        const isAuthorized = await checkRole(
            interaction.user.id,
            process.env.DISCORD_AUTHORIZED_ROLE_ID
        );

        // /create: somente Dono
        if (
            interaction.commandName === "create" &&
            !isOwner
        ) {
            return interaction.reply({
                content: "Somente o Dono pode criar esse torneio.",
                ephemeral: true
            });
        }

        // /t create: Dono ou Autorizado
        if (
            interaction.commandName === "t" &&
            !isOwner &&
            !isAuthorized
        ) {
            return interaction.reply({
                content: "Você não tem permissão para criar torneios de gemas.",
                ephemeral: true
            });
        }

        // /player nick: somente Dono
        if (
            interaction.commandName === "player" &&
            !isOwner
        ) {
            return interaction.reply({
                content: "Somente o Dono pode alterar nicknames.",
                ephemeral: true
            });
        }

        await interaction.reply({
            content: "Permissão confirmada! A execução será conectada ao backend na próxima etapa.",
            ephemeral: true
        });

    } catch (error) {
        console.error("Erro ao verificar comando:", error);

        const response = {
            content: "Não foi possível verificar suas permissões.",
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
