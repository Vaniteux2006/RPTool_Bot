const fs = require('fs');
const path = require('path');

async function checkBirthdays(client) {
    const dbPath = path.join(__dirname, '../Data/birthdays.json');
    
    // Se não tem banco de dados, nem tenta ler
    if (!fs.existsSync(dbPath)) return;

    let db = {};
    try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { return; }

    const nowUTC = new Date();
    let dbChanged = false;

    // Para cada servidor configurado
    for (const key in db) {
        const config = db[key];
        const [guildId, channelId] = key.split('-');

        // Lógica de Fuso Horário e Bissexto (v2.0 blindada)
        const tzOffset = config.timezone !== undefined ? config.timezone : -3;
        const serverTime = new Date(nowUTC.getTime() + (tzOffset * 3600000) + (nowUTC.getTimezoneOffset() * 60000));
        
        const todayDay = serverTime.getDate();
        const todayMonth = serverTime.getMonth() + 1;
        const currentYear = serverTime.getFullYear();
        const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);

        // Filtra aniversariantes
        const birthdaysToday = config.entries.filter(e => {
            if (e.day === todayDay && e.month === todayMonth) return true;
            if (!isLeapYear && todayDay === 28 && todayMonth === 2 && e.day === 29 && e.month === 2) return true;
            return false;
        });

        // 1. Monta o Texto
        let newText = "📅 **Aniversários:**\nNenhum aniversário por hoje.";
        if (birthdaysToday.length > 0) {
            newText = "🎉 **HOJE É DIA DE FESTA!** 🎉\n\n";
            birthdaysToday.forEach(b => {
                let line = `🎂 **${b.name}**`;
                if (b.day === 29 && b.month === 2 && !isLeapYear) line += " (Antecipado 🐸)";
                if (b.year) line += ` (${currentYear - b.year} anos)`;
                newText += line + "\n";
            });
        }

        // 2. Atualiza Placar (Usando o client passado por parâmetro)
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel) {
                try {
                    const msg = await channel.messages.fetch(config.messageId);
                    if (msg.content !== newText) await msg.edit(newText);
                } catch (err) {
                    console.log(`[BIRTHDAY] Recriando placar em ${channelId}`);
                    const newMsg = await channel.send(newText);
                    config.messageId = newMsg.id;
                    dbChanged = true;
                }
            }
        } catch (e) {}

        // 3. Manda DM
        for (const b of birthdaysToday) {
            if (b.lastNotifiedYear < currentYear) {
                try {
                    const user = await client.users.fetch(b.requesterId);
                    let msg = `🎈 **HOJE É ANIVERSÁRIO DE ${b.name.toUpperCase()}!** AVISE O PESSOAL DISSO!`;
                    if (b.year) msg += `\n(Fazendo ${currentYear - b.year} anos)`;
                    await user.send(msg);
                    b.lastNotifiedYear = currentYear;
                    dbChanged = true;
                } catch (e) { console.log(`[BIRTHDAY] Falha DM: ${b.requesterId}`); }
            }
        }
    }

    if (dbChanged) fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
}

module.exports = {
    name: 'birthday',
    description: 'Gerencia o sistema de Aniversários (Billboard)',
    async execute(message, args) {
        // Sintaxe: rp!birthday Nome Data #canal
        
        // 1. Achar o canal (pode ser menção ou ID no final)
        const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[args.length - 1]);
        if (!channel) return message.reply("⚠️ Faltou o canal! Ex: `rp!birthday Fulano 13/04 #aniversarios`");

        // 2. Achar a data (Regex para DD/MM ou DD/MM/AAAA)
        const dateRegex = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/;
        let dateStr = null;
        let dateIndex = -1;

        // Varre os argumentos procurando algo que pareça uma data
        for (let i = 0; i < args.length; i++) {
            if (dateRegex.test(args[i])) {
                dateStr = args[i];
                dateIndex = i;
                break;
            }
        }

        if (!dateStr) return message.reply("⚠️ Data inválida! Use o formato **DD/MM** ou **DD/MM/AAAA**.");

        // 3. O que sobrou é o Nome (Remove a data e o canal da lista de palavras)
        const nameArgs = args.filter((arg, index) => index !== dateIndex && !arg.includes(channel.id));
        const name = nameArgs.join(" ").replace(/<#\d+>/g, "").trim();

        if (!name) return message.reply("⚠️ Faltou o nome do aniversariante!");

        // 4. Salvar no Banco de Dados
        const dbPath = path.join(__dirname, '../Data/birthdays.json');
        
        // Garante que o arquivo existe
        if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath));
        let db = {};
        if (fs.existsSync(dbPath)) {
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch(e) {}
        }

        const key = `${message.guild.id}-${channel.id}`; // Chave única por Servidor+Canal
        
        if (!db[key]) db[key] = { messageId: null, entries: [] };

        // Parse da data
        const match = dateStr.match(dateRegex);
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = match[3] ? parseInt(match[3]) : null;

        db[key].entries.push({
            requesterId: message.author.id,
            name: name,
            day: day,
            month: month,
            year: year,
            lastNotifiedYear: 0 // Pra saber se já mandamos DM esse ano
        });

        // 5. Verifica se já existe o Placar (Placeholder)
        // Se não existir, cria agora.
        if (!db[key].messageId) {
            try {
                const sentMsg = await channel.send("📅 **Aniversários:**\nNenhum aniversário por hoje.");
                db[key].messageId = sentMsg.id;
            } catch (e) {
                return message.reply(`❌ Erro: Não consegui enviar mensagem em ${channel}. Verifique minhas permissões!`);
            }
        }

        fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
        message.reply(`✅ Aniversário de **${name}** (${dateStr}) registrado em ${channel}!`);
    }
};