
const { Client, GatewayIntentBits } = require("discord.js");

const discord = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

async function startDiscordBot() {
    if (!process.env.DISCORD_BOT_TOKEN) {
        throw new Error("DISCORD_BOT_TOKEN não configurado.");
    }

    await discord.login(process.env.DISCORD_BOT_TOKEN);

    console.log(`Bot conectado: ${discord.user.tag}`);
}

async function checkDiscordRole(userId, roleId) {
    if (!discord.isReady()) {
        throw new Error("Bot do Discord ainda não está conectado.");
    }

    const guild = await discord.guilds.fetch(
        process.env.DISCORD_GUILD_ID
    );

    const member = await guild.members.fetch(userId);

    return member.roles.cache.has(roleId);
}

module.exports = {
    startDiscordBot,
    checkDiscordRole
};
