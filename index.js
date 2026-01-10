require('dotenv').config(); // Carrega o token do arquivo .env
const { Client, GatewayIntentBits } = require('discord.js');

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

// Evento: Quando o bot recebe uma mensagem
client.on('messageCreate', (message) => {
    // Evita que o bot responda a si mesmo
    if (message.author.bot) return;

    // Comando simples
    if (message.content === 'RP!HelloWorld') {
        message.reply('Hello World!');
    }
});

// Faz o login
client.login(process.env.TOKEN);