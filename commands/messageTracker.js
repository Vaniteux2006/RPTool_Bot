const fs = require('fs');
const path = require('path');

// Caminho para a pasta Data
const dataPath = path.join(__dirname, '..', 'Data');
const statsFile = path.join(dataPath, 'statistics.json');

// Função auxiliar para data (DDMMYYYY)
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

    // 1. Carregar o "Bancão" de dados
    let globalStats = {};
    if (fs.existsSync(statsFile)) {
        try {
            const rawData = fs.readFileSync(statsFile);
            globalStats = JSON.parse(rawData);
        } catch (error) {
            console.error("Erro ao ler statistics.json:", error);
        }
    }

    // 2. Garantir que esse servidor tem uma "gaveta" no JSON
    if (!globalStats[guildId]) {
        globalStats[guildId] = {
            users: {},
            chats: {},
            days: {}
        };
    }

    // Atalho para facilitar a escrita (aponta para a gaveta do servidor atual)
    const guildStats = globalStats[guildId];

    // 3. Coletar Dados da mensagem
    const userId = message.author.id;
    const chatName = message.channel.name; 
    const dateKey = getCurrentDateInt();

    // 4. Incrementar contadores
    // -- Usuários
    if (!guildStats.users[userId]) guildStats.users[userId] = 0;
    guildStats.users[userId] += 1;

    // -- Chats
    if (!guildStats.chats[chatName]) guildStats.chats[chatName] = 0;
    guildStats.chats[chatName] += 1;

    // -- Dias
    if (!guildStats.days[dateKey]) guildStats.days[dateKey] = 0;
    guildStats.days[dateKey] += 1;

    // 5. Salvar tudo de volta no arquivo
    fs.writeFileSync(statsFile, JSON.stringify(globalStats, null, 2));
}

module.exports = { trackMessage };