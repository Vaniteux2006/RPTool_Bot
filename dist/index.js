"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fast_average_color_node_1 = require("fast-average-color-node");
const Outros_1 = require("./models/Outros");
const ReturnVersion_1 = __importDefault(require("./ReturnVersion"));
const command_checkout_1 = __importDefault(require("./command_checkout"));
const interaction_checkout_1 = __importDefault(require("./interaction_checkout"));
const autorole_1 = __importDefault(require("./commands/autorole"));
const Outros_2 = require("./models/Outros");
const time_1 = __importDefault(require("./commands/time"));
const reactionListener_1 = require("./reactionListener");
const client = new discord_js_1.Client({
    rest: { timeout: 60 * 60 * 1000 },
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildMembers,
        discord_js_1.GatewayIntentBits.DirectMessages,
        discord_js_1.GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        discord_js_1.Partials.Channel,
        discord_js_1.Partials.Message,
        discord_js_1.Partials.Reaction,
        discord_js_1.Partials.User
    ]
});
client.commands = new discord_js_1.Collection();
const commandsArray = [];
const prefix = "rp!";
function loadCommands(dir) {
    if (!fs_1.default.existsSync(dir))
        return;
    const items = fs_1.default.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path_1.default.join(dir, item.name);
        if (item.isDirectory()) {
            loadCommands(fullPath);
        }
        else if (item.name.endsWith('.ts') || item.name.endsWith('.js')) {
            if (item.name.endsWith('.d.ts'))
                continue;
            if (item.name.includes('command_checkout'))
                continue;
            if (item.name.includes('quote_engine'))
                continue;
            try {
                const imported = require(fullPath);
                const cmdData = imported.default || imported.command || imported;
                if (cmdData.name) {
                    client.commands.set(cmdData.name, cmdData);
                    console.log(`🔹 Comando carregado: ${cmdData.name}`);
                }
                if (cmdData.data && cmdData.executeSlash) {
                    commandsArray.push(cmdData.data.toJSON());
                }
            }
            catch (err) {
                console.error(`❌ Erro ao carregar ${item.name}:`, err);
            }
        }
    }
}
console.log("📂 Carregando comandos...");
loadCommands(path_1.default.join(__dirname, 'commands'));
client.once(discord_js_1.Events.ClientReady, async (readyClient) => {
    console.log(`🤖 Bot online como ${readyClient.user.tag}!`);
    const updateStatus = async () => {
        try {
            const statuses = await Outros_2.BotStatusModel.find({});
            if (statuses.length > 0) {
                const entry = statuses[Math.floor(Math.random() * statuses.length)];
                const text = entry.content.replace('{version}', (0, ReturnVersion_1.default)());
                const typeKey = entry.type;
                client.user?.setActivity(text, { type: discord_js_1.ActivityType[typeKey] });
            }
        }
        catch (e) {
            console.error("Erro ao puxar status do banco:", e);
        }
    };
    updateStatus();
    setInterval(updateStatus, 15000);
    const CLIENT_ID = process.env.CLIENT_ID || readyClient.user.id;
    const TOKEN = process.env.TOKEN;
    await time_1.default.checkAndRestoreClocks(client);
    if (TOKEN) {
        const rest = new discord_js_1.REST().setToken(TOKEN);
        try {
            console.log(`🔄 [DEPLOY] Registrando ${commandsArray.length} comandos...`);
            await rest.put(discord_js_1.Routes.applicationCommands(CLIENT_ID), { body: commandsArray });
            console.log(`✅ [DEPLOY] Sucesso!`);
        }
        catch (error) {
            console.error(`❌ [DEPLOY] Erro:`, error);
        }
    }
});
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (await (0, interaction_checkout_1.default)(interaction, client))
        return;
    if (!interaction.isChatInputCommand())
        return;
    const command = client.commands.get(interaction.commandName);
    if (!command)
        return;
    console.log(`⚡ [SLASH] /${interaction.commandName} | User: ${interaction.user.tag} | Server: ${interaction.guild?.name ?? "DM"} (${interaction.guild?.id ?? "DM"})`);
    try {
        if (command.executeSlash) {
            await command.executeSlash(interaction);
        }
        else if (command.execute) {
            await command.execute(interaction, []);
        }
    }
    catch (error) {
        console.error(error);
        const errPayload = { content: '❌ Erro fatal no comando!', ephemeral: true };
        if (interaction.replied || interaction.deferred)
            await interaction.followUp(errPayload);
        else
            await interaction.reply(errPayload);
    }
});
client.on('messageCreate', async (message) => {
    if (message.author.bot || await (0, command_checkout_1.default)(message, client))
        return;
    if (!message.content.startsWith(prefix))
        return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName)
        return;
    console.log(`📝 [CMD] ${commandName} | User: ${message.author.tag} | Server: ${message.guild?.name ?? "DM"} (${message.guild?.id ?? "DM"})`);
    const command = client.commands.get(commandName) || client.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(commandName));
    if (!command)
        return;
    try {
        command.execute(message, args);
    }
    catch (error) {
        console.error(error);
        message.reply('❌ Houve um erro ao executar esse comando!');
    }
});
client.on(discord_js_1.Events.MessageReactionAdd, async (reaction, user) => {
    await (0, reactionListener_1.handleReactionAdd)(reaction, user);
});
client.on(discord_js_1.Events.MessageReactionRemove, async (reaction, user) => {
    await (0, reactionListener_1.handleReactionRemove)(reaction, user);
});
client.on('guildMemberAdd', async (member) => {
    try {
        await autorole_1.default.giveRole(member);
    }
    catch (e) { }
    try {
        const config = await Outros_1.WelcomeModel.findOne({ guildId: member.guild.id });
        if (!config || !config.channelId)
            return;
        const channel = member.guild.channels.cache.get(config.channelId);
        if (!channel || !channel.isTextBased())
            return;
        let msg = config.joinMsg.replace(/{user}/g, `<@${member.id}>`)
            .replace(/{server}/g, member.guild.name)
            .replace(/{count}/g, member.guild.memberCount.toString());
        let embedColor = 0x5865F2;
        try {
            const url = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const color = await (0, fast_average_color_node_1.getAverageColor)(url);
            embedColor = parseInt(color.hex.replace('#', ''), 16);
        }
        catch (e) { }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedColor)
            .setDescription(msg)
            .setThumbnail(member.user.displayAvatarURL());
        await channel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error("Erro no Welcome:", error);
    }
});
client.on('guildMemberRemove', async (member) => {
    try {
        const config = await Outros_1.WelcomeModel.findOne({ guildId: member.guild.id });
        if (!config || !config.channelId)
            return;
        const channel = member.guild.channels.cache.get(config.channelId);
        if (!channel || !channel.isTextBased())
            return;
        const banLogs = await member.guild.fetchAuditLogs({ limit: 1, type: discord_js_1.AuditLogEvent.MemberBanAdd }).catch(() => null);
        const banLog = banLogs?.entries.first();
        let isBan = false;
        if (banLog && banLog.target.id === member.id && Date.now() - banLog.createdTimestamp < 5000)
            isBan = true;
        const kickLogs = await member.guild.fetchAuditLogs({ limit: 1, type: discord_js_1.AuditLogEvent.MemberKick }).catch(() => null);
        const kickLog = kickLogs?.entries.first();
        let isKick = false;
        if (!isBan && kickLog && kickLog.target.id === member.id && Date.now() - kickLog.createdTimestamp < 5000)
            isKick = true;
        let rawMsg = config.leaveMsg;
        let embedColor = 0x1A2B4C;
        if (isBan) {
            rawMsg = config.banMsg;
            embedColor = 0xFF0000;
        }
        else if (isKick) {
            rawMsg = config.kickMsg;
            embedColor = 0xFFFFFF;
        }
        let msg = rawMsg.replace(/{user}/g, `**${member.user.username}**`)
            .replace(/{server}/g, member.guild.name)
            .replace(/{count}/g, member.guild.memberCount.toString());
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedColor)
            .setDescription(msg)
            .setThumbnail(member.user.displayAvatarURL());
        await channel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error("Erro no Leave/Kick/Ban:", error);
    }
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 [ERRO CRÍTICO] Rejeição:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('🚨 [ERRO FATAL] Exceção:', error);
});
client.login(process.env.TOKEN);
