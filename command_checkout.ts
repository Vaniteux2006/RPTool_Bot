import { Message, Client } from 'discord.js';
import phoneCommand from './commands/phone';
import rollCommand from './commands/roll';
import timeCommand from './commands/time';
import command42 from './commands/42';

import { handleOCMessage } from './commands/webhook'; 
import { handleAIMessage } from './commands/oc'; 
import { handleFichaSubmit } from './commands/ficha';
import birthdayCmd from './commands/birthday';
import ServerStats from './models/ServerStats';

let clocksInitialized = false;

async function trackMessageStats(message: Message) {
    if (!message.guild) return;

    const guildId = message.guild.id;
    const userId = message.webhookId || message.author.id; 
    const channelId = message.channel.id;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; 
    const hour = now.getUTCHours();

    const content = message.content.toLowerCase();
    const rawWords = content.match(/[a-záàâãéèêíïóôõöúçñ]+/g) || [];
    const stopWords = new Set(['como', 'para', 'você', 'isso', 'mais', 'pelo', 'pela', 'esse', 'essa', 'este', 'esta', 'tudo', 'nada', 'quem', 'onde', 'quando', 'porque', 'qual', 'aqui', 'sobre', 'então', 'muito', 'dela', 'dele']);
    
    const wordCounts: Record<string, number> = {};
    for (const w of rawWords) {
        if (w.length > 3 && !stopWords.has(w)) {
            wordCounts[`words.${w}`] = (wordCounts[`words.${w}`] || 0) + 1;
        }
    }

    const updateQuery: any = {
        $inc: {
            total: 1,
            [`users.${userId}`]: 1,
            [`channels.${channelId}`]: 1,
            ...wordCounts 
        }
    };

    ServerStats.findOneAndUpdate(
        { guildId, date: dateStr, hour },
        updateQuery,
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch(() => {});
}

export default async function runSystemChecks(message: Message, client: Client): Promise<boolean> {
    trackMessageStats(message);
    if (message.author.bot) return false;

    if (!clocksInitialized) {
        console.log("🛠️ Checkout acionado: Verificando relógios persistentes...");
        await timeCommand.checkAndRestoreClocks(client);
        clocksInitialized = true; 
    }

    if (await handleAIMessage(message)) return true;
    
    if (await command42.processMessage(message)) return true;

    await handleOCMessage(message); 

    if (await phoneCommand.processPhoneMessage(message)) return true;

    if (await rollCommand.processRoll(message, message.content)) return true;

    if (await handleFichaSubmit(message)) return true;

    setInterval(() => {
        birthdayCmd.updateBirthdayPanels(client).catch(() => {});
    }, 1000 * 60 * 60);
    return false;
};