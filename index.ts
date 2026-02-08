import 'dotenv/config'; 
import { Client, GatewayIntentBits, Collection, ActivityType, Events, REST, Routes, Partials } from 'discord.js';
import fs from 'fs'; 
import path from 'path';

// --- IMPORTS ATUALIZADOS (TS) ---
import ReturnVersion from './ReturnVersion'; 
import runSystemChecks from './command_checkout'; 
import autoroleCommand from './commands/autorole'; 
import statusData from './Data/status.json';

// Interface para o Client Customizado
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
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Channel,
        Partials.Message  
    ]
}) as CustomClient;

client.commands = new Collection();
const commandsArray: any[] = []; 
const prefix = "rp!";

// Função recursiva para carregar comandos .ts e .js (se sobrarem)
function loadCommands(dir: string) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            loadCommands(fullPath);
        } else if (item.name.endsWith('.ts') || item.name.endsWith('.js')) { 
            // Ignora arquivos de definição e o checkout (já importado manualmente)
            if (item.name.endsWith('.d.ts')) continue;
            if (item.name.includes('command_checkout')) continue; 
            if (item.name.includes('tupper_logic')) continue;
            if (item.name.includes('chess_logic')) continue;
            if (item.name.includes('phone_logic')) continue;
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

    // Sistema de Status Rotativo
    let option = 0;
    setInterval(() => {
        const entry = statusData[option];
        const text = entry.content.replace('{version}', ReturnVersion());
        const typeKey = entry.type as keyof typeof ActivityType;
        
        client.user?.setActivity(text, { type: ActivityType[typeKey] });
        option = (option + 1) % statusData.length;
    }, 10000); // 10 segundos

    // Registro de Slash Commands
    const CLIENT_ID = process.env.CLIENT_ID || readyClient.user.id;
    const TOKEN = process.env.TOKEN;

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

// Handler de Slash Commands
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return; 
    
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    try {
        if (command.executeSlash) {
            await command.executeSlash(interaction);
        } else if (command.execute) {
            // Fallback
            await command.execute(interaction, []); 
        }
    } catch (error) {
        console.error(error);
        const errPayload = { content: '❌ Erro fatal no comando!', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(errPayload);
        else await interaction.reply(errPayload);
    }
});

// Handler de Mensagens (Legacy + Sistemas)
client.on('messageCreate', async (message) => {
    // Roda verificação de sistemas (Tupper, Dados, etc)
    if (message.author.bot || await runSystemChecks(message, client)) return;
    
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = client.commands.get(commandName) || client.commands.find((cmd: any) => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;
    try {
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('❌ Houve um erro ao executar esse comando!');
    }
});

// Evento: Novo Membro (Autorole)
client.on('guildMemberAdd', async (member) => {
    try {
        await autoroleCommand.giveRole(member);
    } catch (error) {
        console.error("Erro no Autorole:", error);
    }
});

// Tratamento de Erros Globais
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 [ERRO CRÍTICO] Rejeição:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('🚨 [ERRO FATAL] Exceção:', error);
});

client.login(process.env.TOKEN);