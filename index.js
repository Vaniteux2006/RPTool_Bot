require('dotenv').config(); 
const { Client, GatewayIntentBits, Collection, ActivityType, Events, REST, Routes } = require('discord.js');
const fs = require('fs'); 
const path = require('path');
const ReturnVersion = require('./ReturnVersion.js'); // <--- VOLTOU AQUI

// --- IMPORTAÇÕES DOS SISTEMAS ---
const { processRoll } = require('./commands/roll.js'); 
const { processMessage } = require('./commands/webhook.js');
const phoneCommand = require('./commands/phone.js');
const { trackMessage } = require('./commands/messageTracker.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
const commandsArray = []; 
const prefix = "rp!";

// Função recursiva para carregar comandos e preparar o registro
function loadCommands(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            loadCommands(fullPath);
        } else if (item.name.endsWith('.js')) {
            const command = require(fullPath);
            
            if (command.name) {
                client.commands.set(command.name, command);
            }

            if (command.data && command.executeSlash) {
                commandsArray.push(command.data.toJSON());
            }
        }
    }
}

// Carrega tudo antes de ligar
console.log("📂 Carregando arquivos...");
loadCommands(path.join(__dirname, 'commands'));

// ====================================================
// EVENTO: LIGAR + STATUS + REGISTRO AUTOMÁTICO
// ====================================================
client.once(Events.ClientReady, async readyClient => {
    console.log(`🤖 Bot online como ${readyClient.user.tag}!`);

    // --- SEUS STATUS VOLTARAM ---
    const statusArray = [
        { content: 'INTRODUZINDO: SLASH! (/) 🔥', type: ActivityType.Listening },
        { content: `Rodando v${ReturnVersion()} ⚙️`, type: ActivityType.Playing },
        { content: 'Temos Stockfish! 🐟 (rp!chess)', type: ActivityType.Playing },
        { content: 'rp!help para comandos! 📚', type: ActivityType.Listening },
        { content: 'RS representando o RPG 🧉', type: ActivityType.Playing },
        { content: 'Made In Porto Alegre, RS 🧉', type: ActivityType.Playing },
        { content: 'assistindo hentai 😳', type: ActivityType.Watching },
        { content: 'Eu vou acordar algum dia 👁️', type: ActivityType.Watching },
        { content: `BIG BROTHER IS WATCHING YOU 👁️`, type: ActivityType.Watching },
        { content: '9 anos, vizinho, [...] 💀', type: ActivityType.Listening },
        { content: 'Ouçam Linkin Park 🎸', type: ActivityType.Listening },
        { content: 'When I was, a young boy... 🥀', type: ActivityType.Playing },
        { content: 'My father took me into the city... 🥀', type: ActivityType.Playing },
        { content: '... To see a marching band 🥀', type: ActivityType.Playing },
    ];

    let option = 0;
    setInterval(() => {
        client.user.setActivity(statusArray[option].content, { type: statusArray[option].type });
        option++;
        if (option >= statusArray.length) option = 0;
    }, 5000);
    // ----------------------------

    // --- AUTO-DEPLOY ---
    const CLIENT_ID = process.env.CLIENT_ID || "SEU_ID_AQUI"; 
    const rest = new REST().setToken(process.env.TOKEN);

    try {
        console.log(`🔄 [AUTO-DEPLOY] Atualizando ${commandsArray.length} comandos globais...`);
        
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commandsArray },
        );

        console.log(`✅ [AUTO-DEPLOY] Comandos sincronizados com sucesso!`);
    } catch (error) {
        console.error(`❌ [AUTO-DEPLOY] Erro ao registrar:`, error);
    }
});

// ====================================================
// 1. GERENCIADOR DE SLASH COMMANDS (/)
// ====================================================
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        if (command.executeSlash) {
            await command.executeSlash(interaction);
        } else {
            const argsString = interaction.options.getString('args') || "";
            const args = argsString.split(/ +/);
            
            const fakeMessage = {
                content: `rp!${command.name} ${argsString}`,
                author: interaction.user,
                member: interaction.member,
                guild: interaction.guild,
                channel: interaction.channel,
                client: client,
                createdTimestamp: interaction.createdTimestamp,
                reply: async (payload) => {
                    if (interaction.replied || interaction.deferred) return await interaction.followUp(payload);
                    return await interaction.reply(payload);
                }
            };
            await command.execute(fakeMessage, args);
        }
    } catch (error) {
        console.error(error);
        if (!interaction.replied) await interaction.reply({ content: 'Erro fatal no comando!', ephemeral: true });
    }
});

// ====================================================
// 2. GERENCIADOR DE MENSAGENS (rp!)
// ====================================================
client.on('messageCreate', async message => {
    if (message.author.bot) return; 

    try { await trackMessage(message); } catch (e) {}

    if (await processMessage(message, client)) return;
    if (await phoneCommand.processPhoneMessage(message)) return;
    if (await processRoll(message)) return;

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    try {
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('Houve um erro ao executar esse comando!');
    }
});

client.login(process.env.TOKEN);