// =============================================================
// =============================================================
//                                                            
 //mmmmmm    mmmmmm    mmmmmmmm                      mmmm     
 //##""""##  ##""""#m  """##"""                      ""##     
 //##    ##  ##    ##     ##      m####m    m####m     ##     
 //#######   ######"      ##     ##"  "##  ##"  "##    ##     
 //##  "##m  ##           ##     ##    ##  ##    ##    ##     
 //##    ##  ##           ##     "##mm##"  "##mm##"    ##mmm  
 //""    """ ""           ""       """"      """"       """"  
// =============================================================
// =============================================================                                            
                                                            
// =============================================================
// =============================================================
// Lembrar-se quando terminar:
// git add . 
// git commit -m "Nome da Atualização"
// git push origin main (Ou "teste", que é o ideal). para trocar de branch, "git checkout -b teste" (ou Main)

// protocolos da atualização:
// "1.000.010-xx -> Grandes Commits feitos para o Main"
// "1.000.020-xx" -> Commits feitos para qualquer Branch ou correções de bugs irrelevantes
// "1.000.030-xx" -> Commits para Branch de testes

// o "xx" é, sempre, para seguir em ordem crescente. 
// a primeira versão é a 1.000.010-01, a segunda vai ser 1.000.010-02,
// se houver uma branch, vai ser a 1.000.020-01, se alguém fizer commit, 
// será 1.000.020-02. etc 

// "node index.js" para iniciar o bot. Ctrl + C para desliga-lo 
// "python api.py" para iniciar a IA

// Checagem antes do push:
// 1: gitignore tem que ter:
//  node_modules
//  .env
//  __pycache__/
//  *.pyc
//  python_api/__pycache__/

// 2: Ultima linha tem que ser "(process.env.TOKEN)"

// 3: sempre rodar esse comando antes de git add .:
//  git rm -r --cached .env

//====================================================
// =============================================================

require('dotenv').config(); 
const { Client, GatewayIntentBits, Collection, ActivityType, Events } = require('discord.js');
const fs = require('fs'); 
const path = require('path');


// --- IMPORTAÇÕES DOS SISTEMAS ---
const { processRoll } = require('./commands/roll.js'); 
const { giveRole } = require('./commands/autorole.js');
const { processMessage } = require('./commands/webhook.js');
const phoneCommand = require('./commands/phone.js');
const ReturnVersion = require('./ReturnVersion.js');
const { trackMessage } = require('./commands/messageTracker.js');

// Configurações do Cliente
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Bot Online
client.once(Events.ClientReady, readyClient => {
    console.log(`🤖 Bot online como ${readyClient.user.tag}!`);

    // Lista de frases
    const statusArray = [
        { content: `Estamos em Manutençao 🛠️`, type: ActivityType.Playing },
    ];

    let option = 0;
    setInterval(() => {
        client.user.setActivity(statusArray[option].content, { type: statusArray[option].type });
        option++;
        if (option >= statusArray.length) option = 0;
    }, 5000); // 10000 ms = 10 segundos
});

// Carregamento de Comandos
client.commands = new Collection();
const prefix = "rp!";

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

// ====================================================
// EVENTO: ENTRADA DE MEMBRO
// ====================================================
client.on('guildMemberAdd', async member => {
    await giveRole(member);
});

// ====================================================
// EVENTO: MENSAGEM (O Maestro Otimizado)
// ====================================================
client.on('messageCreate', async message => {
    if (message.author.bot) return; 

    // --- NOVO: RASTREADOR DE STATS ---
    try {
        await trackMessage(message);
    } catch (err) {
        console.error("Erro ao salvar stats:", err);
    }

    // 1. SISTEMA DE TUPPER (WEBHOOK)
    if (await processMessage(message, client)) return;

    // 2. TELEFONE 
    if (await phoneCommand.processPhoneMessage(message)) return;

    // 3. SISTEMA DE DADOS (ROLL)
    if (await processRoll(message)) return;

    // 4. COMANDOS NORMAIS (rp!)
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Procura pelo nome exato OU por um alias (apelido)
    const command = client.commands.get(commandName) 
        || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    try {
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('Houve um erro ao executar esse comando!');
    }
});

client.login(process.env.TOKEN);