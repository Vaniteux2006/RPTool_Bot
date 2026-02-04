import fs from 'fs';
import path from 'path';
import { Message } from 'discord.js';

const dataPath = path.join(__dirname, '../Data');
const statsFile = path.join(dataPath, 'statistics.json');

interface GlobalStats {
    [guildId: string]: {
        users: { [userId: string]: number };
        chats: { [channelName: string]: number };
        days: { [dateKey: string]: number };
    }
}

function getCurrentDateInt(): number {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); 
    const year = now.getFullYear();
    return parseInt(`${day}${month}${year}`);
}

export default async function trackMessage(message: Message) {
    if (!message.guild) return;

    const guildId = message.guild.id;

    let globalStats: GlobalStats = {};
    
    // Garante diretório
    if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });

    if (fs.existsSync(statsFile)) {
        try {
            const rawData = fs.readFileSync(statsFile, 'utf-8');
            globalStats = JSON.parse(rawData);
        } catch (error) {
            console.error("Erro ao ler statistics.json:", error);
        }
    }

    if (!globalStats[guildId]) {
        globalStats[guildId] = {
            users: {},
            chats: {},
            days: {}
        };
    }

    const guildStats = globalStats[guildId];

    const userId = message.author.id;
    // @ts-ignore: Propriedade 'name' pode não existir em DM, mas validamos guild antes
    const chatName = (message.channel as any).name || message.channel.id; 
    const dateKey = getCurrentDateInt();

    // Contagem User
    if (!guildStats.users[userId]) guildStats.users[userId] = 0;
    guildStats.users[userId] += 1;

    // Contagem Chat
    if (!guildStats.chats[chatName]) guildStats.chats[chatName] = 0;
    guildStats.chats[chatName] += 1;

    // Contagem Dia
    const dateKeyStr = dateKey.toString();
    if (!guildStats.days[dateKeyStr]) guildStats.days[dateKeyStr] = 0;
    guildStats.days[dateKeyStr] += 1;

    try {
        fs.writeFileSync(statsFile, JSON.stringify(globalStats, null, 4));
    } catch (e) {
        console.error("Erro ao salvar estatísticas:", e);
    }
}