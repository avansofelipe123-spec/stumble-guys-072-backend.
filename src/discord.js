
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

const commands = [
    new SlashCommandBuilder()
        .setName("create")
        .setDescription("Criar torneio de gemas")
        .addStringOption(option =>
            option.setName("nome")
                .setDescription("Nome do torneio")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("participantes")
                .setDescription("Máximo de participantes")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("rodadas")
                .setDescription("Quantidade de rodadas")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("modo")
                .setDescription("Modo do torneio")
                .setRequired(true)
                .addChoices(
                    { name: "Solo", value: "solo" },
                    { name: "Duos", value: "duos" }
                )),

    new SlashCommandBuilder()
        .setName("player")
        .setDescription("Gerenciar jogadores")
        .addSubcommand(subcommand =>
            subcommand
                .setName("nick")
                .setDescription("Alterar nickname de um jogador")
                .addIntegerOption(option =>
                    option.setName("id")
                        .setDescription("ID do jogador")
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName("nickname")
                        .setDescription("Novo nickname")
                        .setRequired(true))),

    new SlashCommandBuilder()
        .setName("t")
        .setDescription("Gerenciar torneios clássicos")
        .addSubcommand(subcommand =>
            subcommand
                .setName("create")
                .setDescription("Criar torneio clássico")
                .addStringOption(option =>
                    option.setName("nome")
                        .setDescription("Nome do torneio")
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName("duracao")
                        .setDescription("Duração em dias")
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName("mapa")
                        .setDescription("Mapa do torneio")
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName("premio")
                        .setDescription("Prêmio")
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName("entrada")
                        .setDescription("Custo de entrada")
                        .setRequired(true)))
].map(command => command.toJSON());

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

async function checkRole(userId, roleId) {
    if (!roleId) return false;

    const guild = await discord.guilds.fetch(
        process.env.DISCORD_GUILD_ID
    );

    const member = await guild.members.fetch(userId);

    return member.roles.cache.has(roleId);
}

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

        if (
            interaction.commandName === "create" &&
            !isOwner &&
            !isAuthorized
        ) {
            return interaction.reply({
                content: "Você não tem permissão para usar este comando.",
                ephemeral: true
            });
        }

        if (
            (interaction.commandName === "player" ||
             interaction.commandName === "t") &&
            !isOwner
        ) {
            return interaction.reply({
                content: "Somente o Dono pode usar este comando.",
                ephemeral: true
            });
        }

        await interaction.reply({
            content: "Comando reconhecido! A execução será conectada ao backend na próxima etapa.",
            ephemeral: true
        });

    } catch (error) {
        console.error("Erro no comando Discord:", error);

        const response = {
            content: "Ocorreu um erro ao verificar suas permissões.",
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(response).catch(() => {});
        } else {
            await interaction.reply(response).catch(() => {});
        }
    }
});

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
