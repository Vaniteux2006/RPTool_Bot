import { Client, Guild } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import { MessageModel, JoinModel, VoiceModel } from './models/AnalyticsSchema';

export interface DashboardStats {
audit: { bans: number; warns: number; roles: number };
events: { messages: number; calls: number; joins: number };
topUsers: { name: string; messages: number; call: number; avatar?: string }[];
activity: { hours: string[]; messages: number[]; calls: number[] };
inactiveChannels: { name: string; time: string }[];
}

export function startCollector(client: Client) {
client.on("messageCreate", async (message) => {
if (message.author.bot || !message.guild) return;
await MessageModel.create({
userId: message.author.id,
channelId: message.channel.id,
guildId: message.guild.id,
timestamp: Date.now()
}).catch(() => {});
});

client.on("guildMemberAdd", async (member) => {
    await JoinModel.create({
        guildId: member.guild.id,
        userId: member.user.id,
        timestamp: Date.now()
    }).catch(() => {});
});

client.on("voiceStateUpdate", async (oldState, newState) => {
    if (!oldState.channel && newState.channel) {
        await VoiceModel.create({
            guildId: newState.guild.id,
            userId: newState.id,
            channelId: newState.channel.id,
            joinTime: Date.now(),
            leaveTime: null,
            duration: 0
        }).catch(() => {});
    }
    if (oldState.channel && !newState.channel) {
        const session = await VoiceModel.findOne({
            guildId: oldState.guild.id,
            userId: oldState.id,
            leaveTime: null
        }).sort({ joinTime: -1 });

        if (session && session.joinTime) {
            session.leaveTime = Date.now();
            session.duration = session.leaveTime - session.joinTime;
            await session.save().catch(() => {});
        }
    }
});
}

export async function generateRealStats(guild: Guild): Promise<DashboardStats> {
const guildId = guild.id;
const last24h = Date.now() - 86400000;

const messages = await MessageModel.find({ guildId, timestamp: { $gt: last24h } });
const joins = await JoinModel.countDocuments({ guildId, timestamp: { $gt: last24h } });
const voiceSessions = await VoiceModel.find({ guildId, joinTime: { $gt: last24h } });

const userCounts: Record<string, number> = {};
messages.forEach(m => {
    if (m.userId) {
        if (!userCounts[m.userId]) userCounts[m.userId] = 0;
        userCounts[m.userId]++;
    }
});

const callTime: Record<string, number> = {};
voiceSessions.forEach(v => {
    if (v.userId && v.duration) {
        if (!callTime[v.userId]) callTime[v.userId] = 0;
        callTime[v.userId] += v.duration;
    }
});

const topUsers = await Promise.all(
    Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(async ([id, count]) => {
            const duration = callTime[id] || 0;
            return {
                name: id,
                messages: count,
                call: Math.round(duration / 3600000)
            };
        })
);

let banCount = 0;
let roleCount = 0;
try {
    const bansLogs = await guild.fetchAuditLogs({ type: 22, limit: 20 });
    const roleLogs = await guild.fetchAuditLogs({ type: 25, limit: 20 });
    banCount = bansLogs.entries.filter(log => log.createdTimestamp > last24h).size;
    roleCount = roleLogs.entries.filter(log => log.createdTimestamp > last24h).size;
} catch (e) {
    console.warn("Sem permissão para ler Audit Logs.");
}

return {
    audit: { bans: banCount, warns: 0, roles: roleCount },
    events: { messages: messages.length, calls: voiceSessions.length, joins: joins },
    topUsers: topUsers,
    activity: { hours: ["12h", "18h", "00h", "06h"], messages: [0, 0, 0, 0], calls: [0, 0, 0, 0] },
    inactiveChannels: []
};
}

export async function generateDashboard(guild: Guild, data: DashboardStats): Promise<Buffer> {
const width = 1400;
const height = 800;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

ctx.fillStyle = "#0f1117";
ctx.fillRect(0, 0, width, height);

ctx.fillStyle = "#ffffff";
ctx.font = "28px Sans-serif";
ctx.fillText(`${guild.name} Analytics`, 40, 50);

// COLA O RESTO DO CÓDIGO DO CANVAS DO IVANOL AQUI
// ...

return canvas.toBuffer();
}