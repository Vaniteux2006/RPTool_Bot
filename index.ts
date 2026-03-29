import 'dotenv/config'; 
import { Client, GatewayIntentBits, Collection, ActivityType, Events, REST, Routes, Partials, AuditLogEvent, EmbedBuilder } from 'discord.js';
import fs from 'fs'; 
import path from 'path';
import loadEvents from './tools/utils/eventLoader';

import ReturnVersion from './tools/ReturnVersion'; 
import runSystemChecks from './tools/command_checkout'; 
import runInteractionChecks from './tools/interaction_checkout';
import { BotStatusModel } from './tools/models/Outros';
import timeCommand from './commands/time';
import { handleReactionAdd, handleReactionRemove } from './tools/reactionListener';
import runMemberChecks from './tools/member_checkout';

const stockfishPath = '/home/node/stockfish'; 

try {
    if (fs.existsSync(stockfishPath)) {
        fs.chmodSync(stockfishPath, 0o755);
        console.log('♟️ [XADREZ] Permissão de execução concedida ao Stockfish com sucesso!');
    } else {
        console.log('⚠️ [XADREZ] Arquivo do Stockfish não encontrado no caminho:', stockfishPath);
    }
} catch (error) {
    console.error('❌ [XADREZ] Erro ao tentar dar permissão ao Stockfish:', error);
}

interface CustomClient extends Client {
    commands: Collection<string, any>;
}

const client = new Client({
    rest: { timeout: 60 * 60 * 1000 },
    intents: [
        GatewayIntentBits.Guilds, // O básico para o bot funcionar
        GatewayIntentBits.GuildMembers, // 📥 Para logs de Entrada, Saída e Cargos
        GatewayIntentBits.GuildModeration, 
        GatewayIntentBits.GuildExpressions,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks, // 🪝 Escuta Webhooks
        GatewayIntentBits.GuildInvites, // 🔗 Escuta Convites
        GatewayIntentBits.GuildVoiceStates, // 🎙️ (Caso você use logs de call no futuro)
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages, // 💬 Escuta as mensagens
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent, // 📝 Escuta o CONTEÚDO das mensagens (para log de deletada/editada)
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
const cooldowns = new Map<string, number>(); 
const commandStrikes = new Map<string, number[]>(); 

// --- INÍCIO: CARREGADOR DE SUPERCOMANDOS ---
const supercommandsPath = path.join(__dirname, 'supercommands');
if (fs.existsSync(supercommandsPath)) {
    const superFolders = fs.readdirSync(supercommandsPath);
    for (const folder of superFolders) {
        const folderPath = path.join(supercommandsPath, folder);
        
        // Verifica se é realmente uma pasta
        if (fs.statSync(folderPath).isDirectory()) {
            // Suporta rodar tanto em TS puro quanto no dist/ depois de compilado
            const mainFileTs = path.join(folderPath, 'index.ts');
            const mainFileJs = path.join(folderPath, 'index.js');
            
            const fileToLoad = fs.existsSync(mainFileTs) ? mainFileTs : (fs.existsSync(mainFileJs) ? mainFileJs : null);

            if (fileToLoad) {
                const command = require(fileToLoad).default;
                if (command && command.name) {
                    client.commands.set(command.name, command);
                    console.log(`[SuperComandos] Ecossistema carregado: ${command.name}`);
                }
            }
        }
    }
}
// --- FIM: CARREGADOR DE SUPERCOMANDOS ---

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
    const TOKEN = process.env.xdTOKEN;
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
    if (message.author.bot) return;

    const isSystemHandled = await runSystemChecks(message, client);
    
    if (isSystemHandled) return;

    if (!message.content.startsWith('rp!')) return;

    const guildId = message.guild ? message.guild.id : message.author.id;
    const now = Date.now();

    if (cooldowns.has(guildId)) {
        const expiration = cooldowns.get(guildId)!;
        if (now < expiration) {
            return; 
        } else {
            cooldowns.delete(guildId);
            commandStrikes.set(guildId, []);
        }
    }

    const timestamps = commandStrikes.get(guildId) || [];
    const recentCommands = timestamps.filter(ts => now - ts < 10000);
    recentCommands.push(now);

    if (recentCommands.length >= 6) {
        cooldowns.set(guildId, now + 20000);
        return message.reply("🛑 **CALMA AI MEU IRMÃO! TO LIDANDO COM MUITOS COMANDOS AO MESMO TEMPO! ESPERA!** (Comandos bloqueados por 20 segundos)");
    } else {
        commandStrikes.set(guildId, recentCommands);
    }
    
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

client.on(Events.GuildMemberAdd, async (member) => {
    await runMemberChecks(member, client);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 [ERRO CRÍTICO] Rejeição:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('🚨 [ERRO FATAL] Exceção:', error);
});

loadEvents(client);

client.login(process.env.xdTOKEN);