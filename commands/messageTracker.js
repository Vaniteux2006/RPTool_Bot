const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'Data');
const statsFile = path.join(dataPath, 'statistics.json');

function getCurrentDateInt() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); 
    const year = now.getFullYear();
    return parseInt(`${day}${month}${year}`);
}

async function trackMessage(message) {
    if (!message.guild) return;

    const guildId = message.guild.id;

    let globalStats = {};
    if (fs.existsSync(statsFile)) {
        try {
            const rawData = fs.readFileSync(statsFile);
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
    const chatName = message.channel.name; 
    const dateKey = getCurrentDateInt();

    if (!guildStats.users[userId]) guildStats.users[userId] = 0;
    guildStats.users[userId] += 1;

    if (!guildStats.chats[chatName]) guildStats.chats[chatName] = 0;
    guildStats.chats[chatName] += 1;

    if (!guildStats.days[dateKey]) guildStats.days[dateKey] = 0;
    guildStats.days[dateKey] += 1;

    fs.writeFileSync(statsFile, JSON.stringify(globalStats, null, 2));
}

module.exports = { trackMessage };