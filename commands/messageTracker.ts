import { Message } from 'discord.js';
import ServerStats, { BlockedWordsModel } from '../models/ServerStats';

const blockedWordsCache = new Map<string, Set<string>>();

export async function loadBlockedWords(guildId: string) {
    const doc = await BlockedWordsModel.findOne({ guildId });
    if (doc) {
        blockedWordsCache.set(guildId, new Set(doc.words));
    } else {
        blockedWordsCache.set(guildId, new Set());
    }
    return blockedWordsCache.get(guildId);
}

export default async function trackMessage(message: Message) {
    if (!message.guild || message.author.bot || message.content.startsWith('rp!')) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const channelId = message.channel.id;

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const hour = now.getHours();

    const rawWords: string[] = message.content.toLowerCase().match(/\b[\wáéíóúâêôãõçü]{3,}\b/g) || [];
    
    let blocklist = blockedWordsCache.get(guildId);
    if (!blocklist) {
        blocklist = await loadBlockedWords(guildId);
    }

    const validWords = rawWords.filter(w => 
        !blocklist!.has(w) && 
        !w.includes('http') && 
        !w.includes('tenor') &&
        !w.includes('https')
    );

    const incData: any = { total: 1 };
    incData[`users.${userId}`] = 1;
    incData[`channels.${channelId}`] = 1;

    for (const word of validWords) {
        incData[`words.${word}`] = 1;
    }

    try {
        await ServerStats.findOneAndUpdate(
            { guildId, date: dateStr, hour },
            { $inc: incData },
            { upsert: true, setDefaultsOnInsert: true }
        );
    } catch (e) {
        console.error("Erro ao salvar estatísticas no MongoDB:", e);
    }
}