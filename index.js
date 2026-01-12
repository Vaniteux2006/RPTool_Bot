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
const pythonManager = require('./python_codes/python_manager.js');

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
        { content: `Rodando v${ReturnVersion()} ⚙️`, type: ActivityType.Playing },
        { content: 'Temos Stockfish! 🐟 (rp!chess)', type: ActivityType.Playing },
        { content: 'rp!help para comandos! 📚', type: ActivityType.Listening },
        { content: 'Made In Porto Alegre, RS 🧉', type: ActivityType.Playing },
        { content: 'assistindo hentai 😳', type: ActivityType.Watching },
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
    }, 5000); // 10000 ms = 10 segundos
});

// Carregamento de Comandos
client.commands = new Collection();
const prefix = "rp!";

function loadCommands(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            loadCommands(fullPath);
        } else if (file.endsWith('.js')) {
            // AQUI ESTÁ A CORREÇÃO: path.resolve()
            // Isso transforma "commands\ai.js" em "C:\Users\...\commands\ai.js"
            // O require nunca erra com caminho completo.
            const command = require(path.resolve(fullPath));
            
            // Proteção extra: só carrega se tiver nome
            if (command.name) {
                client.commands.set(command.name, command);
                console.log(`✅ Comando carregado: ${command.name} de ${fullPath}`);
            }
        }
    }
}
loadCommands('./commands');
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

    // 1. SISTEMA DE TUPPER (WEBHOOK)
    if (await processMessage(message, client)) return;

    // 2. TELEFONE 
    if (await phoneCommand.processPhoneMessage(message)) return;

    if (global.aiSessions && global.aiSessions[message.channel.id]) {
        const session = global.aiSessions[message.channel.id];

        // Se NÃO tem o gatilho, apenas guarda no buffer
        if (!message.content.includes(':ai')) {
            session.buffer.push(`${message.author.username}: ${message.content}`);
            if (session.buffer.length > 20) session.buffer.shift();
        } 
        else {
            // É O GATILHO! Hora de responder.
            const cleanContent = message.content.replace(':ai', '').trim();
            session.buffer.push(`${message.author.username} (USER): ${cleanContent}`);
            
            // Avisa que está pensando
            const thinkingMsg = await message.channel.send(`🧠 **${session.tupperName}** está pensando...`);

            try {
                await pythonManager.ensureConnection();
                
                const payload = {
                    uid: session.ownerId,
                    tupper_name: session.tupperName,
                    context: session.buffer
                };

                const response = await fetch('http://127.0.0.1:8000/tupper/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const data = await response.json();
                
                // Apaga o "pensando" e manda a resposta
                await thinkingMsg.delete();
                
                if (data.reply) {
                    // Opcional: Adiciona a resposta da própria IA no buffer pra ela lembrar o que disse
                    session.buffer.push(`${session.tupperName}: ${data.reply}`);
                    message.channel.send(`**${session.tupperName}:** ${data.reply}`);
                } else {
                    message.channel.send(`❌ Erro: ${data.error || "IA muda."}`);
                }

            } catch (e) {
                console.error(e);
                thinkingMsg.edit("❌ Erro de conexão com o cérebro.");
            }
            return; // Impede de processar outros comandos
        }
    }
    // 3. SISTEMA DE DADOS (ROLL)
    if (await processRoll(message)) return;

    // 4. COMANDOS NORMAIS (rp!)
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (!client.commands.has(commandName)) return;

    try {
        client.commands.get(commandName).execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('Houve um erro ao executar esse comando!');
    }
});

client.login(process.env.TOKEN);