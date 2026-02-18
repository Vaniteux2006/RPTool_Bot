"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = trackMessage;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dataPath = path_1.default.join(__dirname, '../Data');
const statsFile = path_1.default.join(dataPath, 'statistics.json');
function getCurrentDateInt() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return parseInt(`${day}${month}${year}`);
}
async function trackMessage(message) {
    if (!message.guild)
        return;
    const guildId = message.guild.id;
    let globalStats = {};
    if (!fs_1.default.existsSync(dataPath))
        fs_1.default.mkdirSync(dataPath, { recursive: true });
    if (fs_1.default.existsSync(statsFile)) {
        try {
            const rawData = fs_1.default.readFileSync(statsFile, 'utf-8');
            globalStats = JSON.parse(rawData);
        }
        catch (error) {
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
    const chatName = message.channel.name || message.channel.id;
    const dateKey = getCurrentDateInt();
    if (!guildStats.users[userId])
        guildStats.users[userId] = 0;
    guildStats.users[userId] += 1;
    if (!guildStats.chats[chatName])
        guildStats.chats[chatName] = 0;
    guildStats.chats[chatName] += 1;
    const dateKeyStr = dateKey.toString();
    if (!guildStats.days[dateKeyStr])
        guildStats.days[dateKeyStr] = 0;
    guildStats.days[dateKeyStr] += 1;
    try {
        fs_1.default.writeFileSync(statsFile, JSON.stringify(globalStats, null, 4));
    }
    catch (e) {
        console.error("Erro ao salvar estatísticas:", e);
    }
}
