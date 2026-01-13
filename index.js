require('dotenv').config(); 
const { Client, GatewayIntentBits, Collection, ActivityType, Events } = require('discord.js');
const fs = require('fs'); 
const path = require('path');

const { processRoll } = require('./commands/roll.js'); 
const { giveRole } = require('./commands/autorole.js');
const { processMessage } = require('./commands/webhook.js');
const phoneCommand = require('./commands/phone.js');
const ReturnVersion = require('./ReturnVersion.js');
const pythonManager = require('./python_codes/python_manager.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once(Events.ClientReady, readyClient => {
    console.log(`🤖 Bot online como ${readyClient.user.tag}!`);
    const statusArray = [
        { content: `Rodando v${ReturnVersion()} ⚙️`, type: ActivityType.Playing },
        { content: 'rp!help para comandos! 📚', type: ActivityType.Listening },
    ];
    let option = 0;
    setInterval(() => {
        client.user.setActivity(statusArray[option].content, { type: statusArray[option].type });
        option++; if (option >= statusArray.length) option = 0;
    }, 5000);
});

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
            const command = require(path.resolve(fullPath));
            if (command.name) client.commands.set(command.name, command);
        }
    }
}
loadCommands('./commands');

client.on('guildMemberAdd', async member => { await giveRole(member); });

client.on('messageCreate', async message => {
    if (message.author.bot) return; 

    if (await processMessage(message, client)) return; 
    if (await phoneCommand.processPhoneMessage(message)) return; 

    if (global.aiSessions && global.aiSessions[message.channel.id]) {
        const session = global.aiSessions[message.channel.id];
        
        const trigger = `${session.prefix}:ai`;
        const isCommand = message.content.toLowerCase().startsWith(trigger.toLowerCase());
        const isAuto = session.autoMode;

        if (isAuto || isCommand) {
            
            let userContent = message.content;

            if (isCommand) {
                userContent = message.content.slice(trigger.length).trim();
                try { await message.delete(); } catch(e) {}
                if (!userContent) userContent = "(Olhou para você esperando resposta)"; 
            }
            
            session.buffer.push(`${message.author.username}: ${userContent}`);
            if (session.buffer.length > 30) session.buffer.shift();

            const COOLDOWN = 50000; 
            const now = Date.now();
            if (!session.lastCheck) session.lastCheck = 0;

            if (isAuto && !isCommand) {
                if (now - session.lastCheck < COOLDOWN) {
                    return;
                }
                session.lastCheck = now; 
            }

            if (isCommand) await message.channel.sendTyping();

            try {
                await pythonManager.ensureConnection();
                
                const response = await fetch('http://127.0.0.1:8000/tupper/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid: session.ownerId,
                        tupper_name: session.tupperName,
                        context: session.buffer
                    })
                });
                
                const data = await response.json();
                
                if (data.reply) {
                    if (isAuto) await message.channel.sendTyping();
                    
                    session.buffer.push(`${session.tupperName}: ${data.reply}`);
                    
                    await sendAsWebhook(message.channel, session.tupperName, session.avatar, data.reply);
                } 

            } catch (e) {
                console.error(e);
                if (isCommand) message.channel.send("❌ (Erro na matrix)");
            }
            return; 
        } 
        else {
            session.buffer.push(`${message.author.username}: ${message.content}`);
            if (session.buffer.length > 20) session.buffer.shift();
        }
    }

    async function sendAsWebhook(channel, name, avatar, content) {
        try {
            const webhooks = await channel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.owner.id === client.user.id);
            if (!webhook) webhook = await channel.createWebhook({ name: 'RPTool Hook', avatar: client.user.displayAvatarURL() });
            await webhook.send({ content: content, username: name, avatarURL: avatar });
        } catch (error) {
            channel.send(`**${name}:** ${content}`);
        }
    }

    if (await processRoll(message)) return;

    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    if (!client.commands.has(commandName)) return;
    try { client.commands.get(commandName).execute(message, args); } catch (error) { console.error(error); }
});

client.login(process.env.TOKEN);