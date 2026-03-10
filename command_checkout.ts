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
    const stopWords = new Set(['como', 'para', 'você', 'isso', 'mais', 'pelo', 'pela', 'esse', 'essa', 'este', 'esta', 'tudo', 'nada', 'quem', 'onde', 'quando', 'porque', 'qual', 'aqui', 'sobre', 'então', 'muito', 'dela', 'dele', "https", "view", "tenor"]);

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
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).catch(() => { });
}

export default async function runSystemChecks(message: Message, client: Client): Promise<boolean> {
    trackMessageStats(message);
    if (message.author.bot) return false;

// Uso pessoal de Vaniteux. Futuramnete será excluído.
    if (message.guild?.id === '1477540310014886041' && message.author.id === '887364893966217236') {
        const msgContent = message.content.toLowerCase().trim();
        
        if (msgContent === 'qw' || msgContent === 'qwerty') {
            try {
                const member = await message.guild.members.fetch(message.author.id);
                
                await message.delete().catch(() => {}); 
                
                await member.kick('Protocolo de Segurança QWERTY Ativado.');
                
                console.log('🚨 ALERTA: Protocolo QWERTY executado com sucesso.');
                
                return true; 
            } catch (error) {
                console.error('❌ Erro crítico ao tentar executar o protocolo de emergência:', error);
            }
        }
    }

    if (!clocksInitialized) {
        console.log("🛠️ Checkout acionado: Verificando relógios persistentes...");
        await timeCommand.checkAndRestoreClocks(client);

        // 🔥 CORREÇÃO CRÍTICA: O setInterval fica AQUI DENTRO para rodar só UMA VEZ na vida útil do bot!
        setInterval(() => {
            birthdayCmd.updateBirthdayPanels(client).catch(() => { });
        }, 1000 * 60 * 60);

        clocksInitialized = true;
    }

    if (await handleAIMessage(message)) return true;
    if (await command42.processMessage(message)) return true;

    if (await handleOCMessage(message)) return true;

    if (await phoneCommand.processPhoneMessage(message)) return true;
    if (await rollCommand.processRoll(message, message.content)) return true;
    if (await handleFichaSubmit(message)) return true;

    return false;
};