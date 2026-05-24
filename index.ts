import 'dotenv/config';
import {
    Client, GatewayIntentBits, Collection, ActivityType,
    Events, REST, Routes, Partials,
} from 'discord.js';
import fs from 'fs';
import path from 'path';

import ReturnVersion from './tools/ReturnVersion';
import runSystemChecks from './tools/command_checkout';
import runInteractionChecks from './tools/interaction_checkout';
import { BotStatusModel } from './tools/models/Outros';
import timeCommand from './commands/time';
import { initEventCheckout } from './tools/event_checkout';

// ─── Permissões do Stockfish ──────────────────────────────────────────────────
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

// ─── Intents ──────────────────────────────────────────────────────────────────
// ⚠️ INTENTS REMOVIDOS intencionalmente (documentação):
//   GuildPresences    (1 << 8)  — rastreamento de presença/status. Alto volume,
//                                 invasivo para open source. Removido.
//   GuildMessageTyping (1<<11)  — "alguém está digitando". Altíssimo volume,
//                                 sem caso de uso. Removido.
//   DirectMessageReactions (1<<13), DirectMessageTyping (1<<14),
//   DirectMessagePolls (1<<25)  — eventos de DM além de mensagens. Removidos.
//
// ⚠️ INTENTS PRIVILEGIADOS (requerem ativação no Discord Developer Portal):
//   GuildMembers      (1 << 1)  — necessário para autorole, welcome, logs de membros
//   MessageContent    (1 << 15) — necessário para comandos de prefixo (rp!...) e logs
const client = new Client({
    rest: { timeout: 60 * 60 * 1000 },
    intents: [
        GatewayIntentBits.Guilds,                      // (1 << 0)  operação básica
        GatewayIntentBits.GuildMembers,                // (1 << 1)  ⚠️ privileged — autorole, welcome, logs de membros
        GatewayIntentBits.GuildModeration,             // (1 << 2)  bans, audit log
        GatewayIntentBits.GuildExpressions,            // (1 << 3)  emoji, stickers, soundboard
        GatewayIntentBits.GuildIntegrations,           // (1 << 4)  bots e integrações
        GatewayIntentBits.GuildWebhooks,               // (1 << 5)  webhooks (sistema de OC/tupper)
        GatewayIntentBits.GuildInvites,                // (1 << 6)  convites
        GatewayIntentBits.GuildVoiceStates,            // (1 << 7)  canais de voz
        GatewayIntentBits.GuildMessages,               // (1 << 9)  comandos e logs de mensagens
        GatewayIntentBits.GuildMessageReactions,       // (1 << 10) reaction roles
        GatewayIntentBits.DirectMessages,              // (1 << 12) comandos por DM (apenas comandos, não logs)
        GatewayIntentBits.MessageContent,              // (1 << 15) ⚠️ privileged — conteúdo de mensagens
        GatewayIntentBits.GuildScheduledEvents,        // (1 << 16) eventos agendados
        GatewayIntentBits.AutoModerationConfiguration, // (1 << 20) regras do AutoMod
        GatewayIntentBits.AutoModerationExecution,     // (1 << 21) disparo de regras do AutoMod
        GatewayIntentBits.GuildMessagePolls,           // (1 << 24) enquetes em servidores
    ],
    partials: [
        Partials.Channel,   // necessário para mensagens em DM (DirectMessages intent)
        Partials.Message,
        Partials.Reaction,
        Partials.User,
    ],
}) as CustomClient;

client.commands = new Collection();
const commandsArray: any[] = [];
const prefix = 'rp!';
const cooldowns = new Map<string, number>();
const commandStrikes = new Map<string, number[]>();

// ─── Carregador de SuperComandos ──────────────────────────────────────────────
// SuperComandos são ecossistemas completos em /supercommands/<nome>/index.ts.
// Ao serem carregados (require), eles registram automaticamente suas inscrições
// nos eventos via EventCheckout (ex: logs registra handlers em todos os eventos).
const supercommandsPath = path.join(__dirname, 'supercommands');
if (fs.existsSync(supercommandsPath)) {
    const superFolders = fs.readdirSync(supercommandsPath);
    for (const folder of superFolders) {
        const folderPath = path.join(supercommandsPath, folder);
        if (fs.statSync(folderPath).isDirectory()) {
            const mainFileTs = path.join(folderPath, 'index.ts');
            const mainFileJs = path.join(folderPath, 'index.js');
            const fileToLoad = fs.existsSync(mainFileTs) ? mainFileTs
                : (fs.existsSync(mainFileJs) ? mainFileJs : null);

            if (fileToLoad) {
                const command = require(fileToLoad).default;
                if (command?.name) {
                    client.commands.set(command.name, command);
                    console.log(`🌟 [Super Comandos] Ecossistema carregado: ${command.name}`);
                }
            }
        }
    }
}

// ─── Carregador de Comandos ───────────────────────────────────────────────────
// Ao carregar cada comando, side-effects de EventCheckout.onX() são executados
// automaticamente — sem precisar adicionar nada no index.ts.
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

console.log('📂 Carregando comandos...');
loadCommands(path.join(__dirname, 'commands'));

// ─── EventCheckout ────────────────────────────────────────────────────────────
// Registra TODOS os eventos do Discord como dispatchers para o registry interno.
// Deve ser chamado APÓS loadCommands e o carregamento de supercomandos, para que
// as inscrições (EventCheckout.onX) já estejam registradas quando os eventos dispararem.
// Substitui o antigo loadEvents() — não é mais necessário usar eventLoader.ts.
initEventCheckout(client);
console.log('🎯 [EventCheckout] Dispatcher conectado ao Client.');

// ─── Evento: Bot Pronto ───────────────────────────────────────────────────────
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
            console.error('Erro ao puxar status do banco:', e);
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
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsArray });
            console.log('✅ [DEPLOY] Sucesso!');
        } catch (error) {
            console.error('❌ [DEPLOY] Erro:', error);
        }
    }
});

// ─── Evento: Interações (Slash + Botões) ──────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
    if (await runInteractionChecks(interaction, client)) return;
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    console.log(`⚡ [SLASH] /${interaction.commandName} | User: ${interaction.user.tag} | Server: ${interaction.guild?.name ?? 'DM'} (${interaction.guild?.id ?? 'DM'})`);

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

// ─── Evento: Mensagens (Comandos de Prefixo rp!) ──────────────────────────────
// Este handler cuida exclusivamente do roteamento de comandos rp!...
// O EventCheckout já despacha MessageCreate para outros subscribers
// (logs, OC auto-responder, etc.) de forma independente.
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isSystemHandled = await runSystemChecks(message, client);
    if (isSystemHandled) return;

    if (!message.content.startsWith(prefix)) return;

    const guildId = message.guild ? message.guild.id : message.author.id;
    const now = Date.now();

    if (cooldowns.has(guildId)) {
        const expiration = cooldowns.get(guildId)!;
        if (now < expiration) return;
        cooldowns.delete(guildId);
        commandStrikes.set(guildId, []);
    }

    const timestamps = commandStrikes.get(guildId) ?? [];
    const recent = timestamps.filter(t => now - t < 10_000);

    if (recent.length >= 8) {
        cooldowns.set(guildId, now + 30_000);
        commandStrikes.set(guildId, []);
        await message.reply('🛑 **Spam detectado!** Esperem 30 segundos antes de usar mais comandos.');
        return;
    }

    recent.push(now);
    commandStrikes.set(guildId, recent);

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const command = client.commands.get(commandName)
        ?? [...client.commands.values()].find(c => c.aliases?.includes(commandName));

    if (!command) return;

    console.log(`📝 [PREFIX] rp!${commandName} | User: ${message.author.tag} | Server: ${message.guild?.name ?? 'DM'} (${message.guild?.id ?? 'DM'})`);

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(`❌ [PREFIX] Erro em rp!${commandName}:`, error);
        await message.reply('❌ Erro interno ao executar o comando.').catch(() => {});
    }
});

// ─── Login ────────────────────────────────────────────────────────────────────
const TOKEN = process.env.xdTOKEN;
if (!TOKEN) {
    console.error('❌ xdTOKEN não encontrado no .env. Bot não pode iniciar.');
    process.exit(1);
}
client.login(TOKEN);
