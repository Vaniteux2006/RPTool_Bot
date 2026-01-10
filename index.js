require('dotenv').config(); // Carrega o token do arquivo .env
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs'); // Módulo para ler arquivos

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

client.on('messageCreate', message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Verifica se o comando existe na nossa coleção
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


// Lembrar-se quando terminar:
// git add . 
// git commit -m "Nome da Atualização"
// git push origin main 

// protocolos da atualização:
// "1.000.010-xx -> Commits feitos para o Main"
// "1.000.020-xx" -> Commits feitos para qualquer Branch
// "1.000.030-xx" -> Commits para Branch de testes

// o "xx" é, sempre, para seguir em ordem crescente. 
// a primeira versão é a 1.000.010-01, a segunda vai ser 1.000.010-02,
// se houver uma branch, vai ser a 1.000.020-01, se alguém fizer commit, 
// será 1.000.020-02. etc 

// "node index.js" para iniciar o bot. Ctrl + C para desliga-lo 
