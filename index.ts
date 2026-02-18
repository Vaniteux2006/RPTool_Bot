import 'dotenv/config'; 
import { Client, GatewayIntentBits, Collection, ActivityType, Events, REST, Routes, Partials, AuditLogEvent, EmbedBuilder } from 'discord.js';
import fs from 'fs'; 
import path from 'path';
import { getAverageColor } from 'fast-average-color-node';
import { WelcomeModel } from './models/Outros';

import ReturnVersion from './ReturnVersion'; 
import runSystemChecks from './command_checkout'; 
import runInteractionChecks from './interaction_checkout';
import autoroleCommand from './commands/autorole'; 
import { BotStatusModel } from './models/Outros';
import timeCommand from './commands/time';
import { handleReactionAdd, handleReactionRemove } from './reactionListener';

interface CustomClient extends Client {
    commands: Collection<string, any>;
}

const client = new Client({
    rest: { timeout: 60 * 60 * 1000 },
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction, 
        Partials.User      
    ]
}) as CustomClient;

client.commands = new Collection();
const commandsArray: any[] = []; 
const prefix = "rp!";

function loadCommands(dir: string) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            loadCommands(fullPath);
        } else if (item.name.endsWith('.ts') || item.name.endsWith('.js')) { 
            if (item.name.endsWith('.d.ts')) continue;
            if (item.name.includes('command_checkout')) continue; 
            if (item.name.includes('quote_engine')) continue;

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
            } catch (err) {
                console.error(`❌ Erro ao carregar ${item.name}:`, err);
            }
        }
    }
}

console.log("📂 Carregando comandos...");
loadCommands(path.join(__dirname, 'commands'));

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`🤖 Bot online como ${readyClient.user.tag}!`);

    const updateStatus = async () => {
        try {
            const statuses = await BotStatusModel.find({});
            if (statuses.length > 0) {
                const entry = statuses[Math.floor(Math.random() * statuses.length)];
                const text = entry.content.replace('{version}', ReturnVersion());
                const typeKey = entry.type as keyof typeof ActivityType;
                
                client.user?.setActivity(text, { type: ActivityType[typeKey] });
            }
        } catch (e) {
            console.error("Erro ao puxar status do banco:", e);
        }
    };

    updateStatus(); 
    setInterval(updateStatus, 15000); 

    const CLIENT_ID = process.env.CLIENT_ID || readyClient.user.id;
    const TOKEN = process.env.TOKEN;
    await timeCommand.checkAndRestoreClocks(client);

    if (TOKEN) {
        const rest = new REST().setToken(TOKEN);
        try {
            console.log(`🔄 [DEPLOY] Registrando ${commandsArray.length} comandos...`);
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commandsArray },
            );
            console.log(`✅ [DEPLOY] Sucesso!`);
        } catch (error) {
            console.error(`❌ [DEPLOY] Erro:`, error);
        }
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (await runInteractionChecks(interaction, client)) return;
    if (!interaction.isChatInputCommand()) return; 
    
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    console.log(`⚡ [SLASH] /${interaction.commandName} | User: ${interaction.user.tag} | Server: ${interaction.guild?.name ?? "DM"} (${interaction.guild?.id ?? "DM"})`);
    
    try {
        if (command.executeSlash) {
            await command.executeSlash(interaction);
        } else if (command.execute) {
            await command.execute(interaction, []); 
        }
    } catch (error) {
        console.error(error);
        const errPayload = { content: '❌ Erro fatal no comando!', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(errPayload);
        else await interaction.reply(errPayload);
    }
});

client.on('messageCreate', async (message) => {

    if (message.author.bot || await runSystemChecks(message, client)) return;
    
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;
    
    console.log(`📝 [CMD] ${commandName} | User: ${message.author.tag} | Server: ${message.guild?.name ?? "DM"} (${message.guild?.id ?? "DM"})`);

    const command = client.commands.get(commandName) || client.commands.find((cmd: any) => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;
    try {
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('❌ Houve um erro ao executar esse comando!');
    }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    await handleReactionAdd(reaction, user);
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
    await handleReactionRemove(reaction, user);
});

client.on('guildMemberAdd', async (member) => {
    try { await autoroleCommand.giveRole(member); } catch (e) {}

    try {
        const config = await WelcomeModel.findOne({ guildId: member.guild.id });
        if (!config || !config.channelId) return;
        const channel = member.guild.channels.cache.get(config.channelId);
        if (!channel || !channel.isTextBased()) return;

        let msg = config.joinMsg.replace(/{user}/g, `<@${member.id}>`)
                                .replace(/{server}/g, member.guild.name)
                                .replace(/{count}/g, member.guild.memberCount.toString());

        let embedColor = 0x5865F2; 
        try {
            const url = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const color = await getAverageColor(url);
            embedColor = parseInt(color.hex.replace('#', ''), 16);
        } catch (e) {}

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setDescription(msg)
            .setThumbnail(member.user.displayAvatarURL()); 

        await (channel as any).send({ embeds: [embed] });
    } catch (error) {
        console.error("Erro no Welcome:", error);
    }
});

client.on('guildMemberRemove', async (member) => {
    try {
        const config = await WelcomeModel.findOne({ guildId: member.guild.id });
        if (!config || !config.channelId) return;
        const channel = member.guild.channels.cache.get(config.channelId);
        if (!channel || !channel.isTextBased()) return;

        const banLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(()=>null);
        const banLog = banLogs?.entries.first();
        let isBan = false;
        if (banLog && banLog.target.id === member.id && Date.now() - banLog.createdTimestamp < 5000) isBan = true;

        const kickLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick }).catch(()=>null);
        const kickLog = kickLogs?.entries.first();
        let isKick = false;
        if (!isBan && kickLog && kickLog.target.id === member.id && Date.now() - kickLog.createdTimestamp < 5000) isKick = true;

        let rawMsg = config.leaveMsg;
        let embedColor = 0x1A2B4C;

        if (isBan) {
            rawMsg = config.banMsg;
            embedColor = 0xFF0000; 
        } else if (isKick) {
            rawMsg = config.kickMsg;
            embedColor = 0xFFFFFF;
        }

        let msg = rawMsg.replace(/{user}/g, `**${member.user.username}**`)
                        .replace(/{server}/g, member.guild.name)
                        .replace(/{count}/g, member.guild.memberCount.toString());

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setDescription(msg)
            .setThumbnail(member.user.displayAvatarURL());

        await (channel as any).send({ embeds: [embed] });
    } catch (error) {
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