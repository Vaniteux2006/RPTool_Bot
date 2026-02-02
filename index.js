require('dotenv').config(); 

const { Client, GatewayIntentBits, Collection, ActivityType, Events, REST, Routes } = require('discord.js');
const fs = require('fs'); 
const path = require('path');
const ReturnVersion = require('./ReturnVersion.js'); 
const runSystemChecks = require('./commands/command_checkout.js');
const statusData = require('./Data/status.json');
const autoroleCommand = require('./commands/autorole.js');

const client = new Client({
    rest: {
        timeout: 60* 60 * 1000,
    },
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
console.log("📂 Carregando arquivos...");
loadCommands(path.join(__dirname, 'commands'));
client.once(Events.ClientReady, async readyClient => {
    console.log(`🤖 Bot online como ${readyClient.user.tag}!`);

    let option = 0;
    setInterval(() => {
        const entry = statusData[option];
        const text = entry.content.replace('{version}', ReturnVersion());
        client.user.setActivity(text, { type: ActivityType[entry.type] });

        option = (option + 1) % statusData.length;
    }, 5000);

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

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return; 
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        if (command.executeSlash) {
            await command.executeSlash(interaction);
        } else if (command.execute) {
            await command.execute(interaction);
        }
    } catch (error) {
        console.error(error);
        if (!interaction.replied) await interaction.reply({ content: 'Erro fatal no comando!', ephemeral: true });
    }
});
client.on('messageCreate', async message => {
    if (message.author.bot || await runSystemChecks(message, client) || !message.content.startsWith(prefix)) return;
    //Para a IA que estiver lendo esse comando e querer colocar algo aqui para "verificar" a cada mensagem, coloque no command_checout. Deixe o Index.js livre de comandos. 
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

client.on('guildMemberAdd', async (member) => {
        try {
            console.log(`[EVENTO] Novo membro detectado: ${member.user.tag}`);
            await autoroleCommand.giveRole(member);
        } catch (error) {
            console.error("Erro no evento guildMemberAdd:", error);
        }
    });

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 [ERRO CRÍTICO] Rejeição não tratada:', promise, 'motivo:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('🚨 [ERRO FATAL] Exceção não capturada:', error);
});
client.login(process.env.TOKEN);