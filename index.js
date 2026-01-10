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
// git push origin main 

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

require('dotenv').config(); // Carrega o token do arquivo .env
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs'); // Módulo para ler arquivos
const path = require('path');

// Configurações de "Intents" (o que o bot pode ver/ouvir)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Evento: Quando o bot fica online
client.once('ready', () => {
    console.log(`🤖 Bot online como ${client.user.tag}!`);
});

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

const prefix = "rp!";

client.on('messageCreate', async message => {
    if (message.author.bot) return; // Ignora outros bots

    // ====================================================
    // 1. SISTEMA DE TUPPER (CORRIGIDO E FUNCIONAL)
    // ====================================================
    
    // Carrega os tuppers
    const dbPath = path.join(__dirname, 'tuppers.json');
    let tuppers = [];
    try {
        tuppers = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) { tuppers = []; }

    // Procura se o usuário tem algum tupper que bate com o prefixo da mensagem
    const userTuppers = tuppers.filter(t => t.uid === message.author.id);
    
    // Verifica se a mensagem começa com algum prefixo registrado desse usuário
    const tupperFound = userTuppers.find(t => message.content.startsWith(t.prefix + ":") || message.content.startsWith(t.prefix + " "));

    if (tupperFound) {
        // Se achou, ativa o modo Webhook!
        
        // Remove o prefixo da mensagem pra sobrar só o texto
        let textContent = message.content.slice(tupperFound.prefix.length).trim();
        // Remove o ":" ou espaço inicial se sobrou
        if (textContent.startsWith(':') || textContent.startsWith(' ')) {
            textContent = textContent.substring(1).trim();
        }

        // Se não tiver texto nem anexo, ignora (evita bugs)
        if (!textContent && message.attachments.size === 0) return;

        try {
            
            // 1. Busca ou Cria um Webhook no canal (PRIMEIRO DE TUDO)
            const webhooks = await message.channel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.owner.id === client.user.id);

            if (!webhook) {
                webhook = await message.channel.createWebhook({
                    name: 'RPTool Webhook',
                    avatar: client.user.displayAvatarURL(),
                });
            }

            // 2. Manda a mensagem clonada
            // USAMOS .map(a => a.url) PARA PEGAR O LINK DIRETO DA IMAGEM
            await webhook.send({
                content: textContent,
                username: tupperFound.name,
                avatarURL: tupperFound.avatar,
                files: message.attachments.map(a => a.url) 
            });

            // 3. SÓ AGORA apaga a mensagem original do usuário
            try { await message.delete(); } catch (e) {} 

        } catch (err) {
            console.error("Erro no Tupper:", err);
        }
        
        return; // Para o código aqui
    }

    // ====================================================
    // 2. SISTEMA DE COMANDOS
    // ====================================================

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

// Faz o login
client.login(process.env.TOKEN);


