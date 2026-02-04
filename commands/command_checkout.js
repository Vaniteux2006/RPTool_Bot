// commands/command_checkout.js
const { processRoll } = require('./roll.js'); 
const { processMessage } = require('./webhook.js');
const phoneCommand = require('./phone.js');
const { trackMessage } = require('./messageTracker.js');
const quoteCommand = require('./quote.js');
const pythonManager = require('../python_codes/python_manager.js'); 

global.aiSessions = global.aiSessions || {};

module.exports = async (message, client) => {
    if (message.author.bot) return false;

    const session = global.aiSessions[message.channel.id];
    
    if (session && session.active) {
        const trigger = `${session.prefix}:ai`;
        if (!message.content.toLowerCase().startsWith(trigger.toLowerCase())) {
            const logEntry = `[${message.author.username}]: ${message.content}`;
            session.buffer.push(logEntry);
            session.lastActivity = Date.now();
        }
    }

    
    if (await processManualAI(message)) return true;
    if (await processMessage(message, client)) return true;
    if (await phoneCommand.processPhoneMessage(message)) return true;
    if (await processRoll(message)) return true;
    if (await quoteCommand.processQuoteTrigger(message)) return true;

    return false;
};

async function processManualAI(message) {
    const session = global.aiSessions[message.channel.id];
    
    if (!session || !session.active) return false;
    
    const trigger = `${session.prefix}:ai`;
    
    if (message.content.toLowerCase().startsWith(trigger.toLowerCase())) {
        console.log(`⚡ [MANUAL] Gatilho acionado!`);

        let userText = message.content.substring(trigger.length).trim();
        
        try { await message.delete(); } catch (e) {}

        const contextToSend = [...session.buffer];
        
        if (userText) {
            contextToSend.push(`[${message.author.username} fala diretamente com você]: ${userText}`);
        } 
        else if (contextToSend.length === 0) {
            return true; 
        }

        session.buffer = [];

        message.channel.sendTyping();

        try {
            await pythonManager.ensureConnection();
            
            const response = await fetch('http://127.0.0.1:8000/tupper/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    uid: session.uid, 
                    tupper_name: session.tupperName, 
                    context: contextToSend 
                })
            });

            const data = await response.json();

            if (data.reply) {
                const webhooks = await message.channel.fetchWebhooks();
                let webhook = webhooks.find(w => w.owner.id === message.client.user.id);
                if (!webhook) {
                    webhook = await message.channel.createWebhook({ 
                        name: 'RPTool Proxy', 
                        avatar: message.client.user.displayAvatarURL() 
                    });
                }
                
                await webhook.send({
                    content: data.reply,
                    username: session.tupperName, 
                    avatarURL: session.avatar     
                });
            }
        } catch (error) {
            console.error("❌ Erro Manual:", error);
            message.channel.send("❌ A IA tropeçou nos fios.");
        }
        return true; 
    }

    return false;
}