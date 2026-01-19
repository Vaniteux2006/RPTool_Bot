const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../Data/birthdays.json');

function lerDB() {
    try {
        if (!fs.existsSync(dbPath)) return {};
        const raw = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(raw);
    } catch (e) { return {}; }
}

function salvarDB(data) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
}

// --- LÓGICA DO PLACAR ---
async function atualizarPlacar(client, guildId) {
    let db = lerDB();
    const config = db[guildId];
    if (!config || !config.channelId) return;

    const nowUTC = new Date();
    const tzOffset = -3; 
    const serverTime = new Date(nowUTC.getTime() + (tzOffset * 3600000) + (nowUTC.getTimezoneOffset() * 60000));
    const todayDay = serverTime.getDate();
    const todayMonth = serverTime.getMonth() + 1;
    const currentYear = serverTime.getFullYear();
    const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);

    const birthdaysToday = config.entries.filter(e => {
        if (e.day === todayDay && e.month === todayMonth) return true;
        if (!isLeapYear && todayDay === 28 && todayMonth === 2 && e.day === 29 && e.month === 2) return true;
        return false;
    });

    let newText = "📅 **Placar de Aniversários:**\nNenhum aniversariante hoje. O dia está tranquilo.";
    if (birthdaysToday.length > 0) {
        newText = "🎉 **HOJE É DIA DE FESTA!** 🎉\n\n";
        birthdaysToday.forEach(b => {
            let line = `🎂 **${b.name.toUpperCase()}**`;
            if (b.aniversarianteId && b.aniversarianteId.match(/^\d+$/)) {
                line += ` (<@${b.aniversarianteId}>)`;
            }
            if (b.day === 29 && b.month === 2 && !isLeapYear) line += " (Antecipado de 29/fev 🐸)";
            if (b.year) line += ` • Completando **${currentYear - b.year} anos**`;
            line += `\n*(Registrado por <@${b.requesterId}>)*`;
            newText += line + "\n";
        });
    }

    try {
        const channel = await client.channels.fetch(config.channelId);
        if (!channel) return;
        let targetMsg = null;
        if (config.messageId) {
            try { targetMsg = await channel.messages.fetch(config.messageId); } catch (e) { targetMsg = null; }
        }
        if (!targetMsg) {
            targetMsg = await channel.send(newText);
            config.messageId = targetMsg.id;
            salvarDB(db);
        } else {
            if (targetMsg.content !== newText) await targetMsg.edit(newText);
        }
        for (const b of birthdaysToday) {
            if (b.lastNotifiedYear < currentYear) {
                try {
                    const requester = await client.users.fetch(b.requesterId);
                    let dmMsg = `🎈 **PSIUU! Hoje é aniversário de ${b.name}!**\nVocê pediu pra eu avisar. Não esqueça de dar parabéns!`;
                    if (b.year) dmMsg += `\n(Fazendo ${currentYear - b.year} anos)`;
                    await requester.send(dmMsg);
                    b.lastNotifiedYear = currentYear;
                    salvarDB(db); 
                } catch (e) {}
            }
        }
    } catch (error) { console.error(`[BIRTHDAY ERROR] Server ${guildId}:`, error.message); }
}

async function checkBirthdays(client) {
    const db = lerDB();
    for (const guildId in db) await atualizarPlacar(client, guildId);
}

module.exports = {
    name: 'birthday',
    description: 'Gerencia Aniversários (Check, Reset, Add)',
    checkBirthdays, 

    // --- MENU SLASH ---
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Sistema de Aniversários')
        .addSubcommand(sub => sub.setName('check').setDescription('Vê a lista de aniversários'))
        .addSubcommand(sub => sub.setName('reset').setDescription('Reseta o sistema (Admin)'))
        .addSubcommand(sub => 
            sub.setName('add')
                .setDescription('Adiciona um aniversário')
                .addUserOption(op => op.setName('pessoa').setDescription('Quem é o aniversariante?').setRequired(true))
                .addStringOption(op => op.setName('data').setDescription('Data (DD/MM ou DD/MM/AAAA)').setRequired(true))
                .addChannelOption(op => op.setName('canal').setDescription('Onde avisar?').setRequired(false))),

    // --- ADAPTADOR ---
    async executeSlash(interaction) {
        const sub = interaction.options.getSubcommand();
        const args = [sub]; // 'check', 'reset' ou 'add'

        if (sub === 'add') {
            const pessoa = interaction.options.getUser('pessoa');
            const data = interaction.options.getString('data');
            const canal = interaction.options.getChannel('canal') || interaction.channel;

            // RECONSTRUÇÃO DA STRING MÁGICA
            // O código antigo espera: rp!birthday <Nome/User> <Data> <#Canal>
            // Vamos simular exatamente isso nos args
            
            // Removemos o 'add' do args para injetar os dados brutos
            args.length = 0; 
            
            // Injeta: <@ID> DATA <#CANAL>
            args.push(`<@${pessoa.id}>`);
            args.push(data);
            args.push(`<#${canal.id}>`);

            // Precisamos injetar as menções no fakeMessage
            interaction.mentionsTemp = {
                users: { first: () => pessoa },
                channels: { first: () => canal }
            };
        }

        const fakeMessage = {
            author: interaction.user,
            member: interaction.member,
            guild: interaction.guild,
            mentions: interaction.mentionsTemp || { users: { first: () => null }, channels: { first: () => null } },
            // Simulamos o client pro atualizarPlacar usar
            client: interaction.client,
            reply: async (payload) => interaction.reply(payload)
        };

        // Fallback para mentions padrão se não foram injetadas
        if (!fakeMessage.mentions.users.first()) fakeMessage.mentions.users.first = () => null;
        if (!fakeMessage.mentions.channels.first()) fakeMessage.mentions.channels.first = () => null;

        await this.execute(fakeMessage, args);
    },

    // --- LÓGICA ORIGINAL ---
    async execute(message, args) {
        const subCommand = args[0] ? args[0].toLowerCase() : null;
        const guildId = message.guild.id;

        // COMANDO: CHECK
        if (subCommand === 'check') {
            const db = lerDB();
            const config = db[guildId];

            if (!config || config.entries.length === 0) {
                return message.reply("📭 Ninguém faz aniversário neste servidor (ou o banco está vazio).");
            }

            const sorted = config.entries.sort((a, b) => {
                if (a.month !== b.month) return a.month - b.month;
                return a.day - b.day;
            });

            const listaTxt = sorted.map(e => {
                const yearStr = e.year ? `/${e.year}` : '';
                return `• **${e.day.toString().padStart(2, '0')}/${e.month.toString().padStart(2, '0')}${yearStr}** - ${e.name} (<@${e.requesterId}>)`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0xFF007F) 
                .setTitle(`🎂 Lista de Aniversariantes - ${message.guild.name}`)
                .setDescription(listaTxt.substring(0, 4000))
                .setFooter({ text: `RPTool v1.2` });

            return message.reply({ embeds: [embed] });
        }

        // COMANDO: RESET
        if (subCommand === 'reset') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply("⛔ **Apenas Administradores podem resetar o sistema de aniversários.**");
            }

            let db = lerDB();
            if (!db[guildId]) return message.reply("⚠️ Não há nada para resetar aqui.");

            try {
                const canal = await message.guild.channels.fetch(db[guildId].channelId);
                const msg = await canal.messages.fetch(db[guildId].messageId);
                if (msg) await msg.delete();
            } catch (e) { }

            delete db[guildId];
            salvarDB(db);

            return message.reply("💥 **Sistema resetado!** Todos os aniversários deste servidor foram apagados e o placar removido.");
        }

        // COMANDO: ADD
        // A. Achar o canal (último argumento ou menção)
        const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[args.length - 1]);
        if (!channel) return message.reply("⚠️ **Erro:** Faltou o canal no final! Ex: `rp!birthday Bruno 15/09 #aniversarios`");

        // B. Achar a data
        const dateRegex = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/;
        let dateIndex = -1;
        let day, month, year = null;

        for (let i = 0; i < args.length; i++) {
            const match = args[i].match(dateRegex);
            if (match) {
                day = parseInt(match[1]);
                month = parseInt(match[2]);
                if (match[3]) year = parseInt(match[3]);
                dateIndex = i;
                break;
            }
        }

        if (dateIndex === -1) return message.reply("⚠️ **Erro:** Data inválida! Use o formato **DD/MM** ou **DD/MM/AAAA**.");
        if (month < 1 || month > 12 || day < 1 || day > 31) return message.reply("⚠️ **Erro:** Data impossível.");

        // C. O que sobrou é o Nome
        const entries = args.filter((_, index) => index !== dateIndex && !args[index].includes(channel.id));
        const nameClean = entries.join(" ").replace(/<@!?\d+>/g, "").trim(); 
        
        let targetId = "NPC"; 
        const mentionedUser = message.mentions.users.first();
        
        if (mentionedUser && args.join(" ").includes(mentionedUser.id)) {
            targetId = mentionedUser.id;
        }

        const finalName = nameClean || (mentionedUser ? mentionedUser.username : "Desconhecido");

        // D. Salvar no Banco
        let db = lerDB();

        if (!db[guildId]) {
            db[guildId] = {
                serverId: guildId, 
                channelId: channel.id,
                messageId: null,
                entries: []
            };
        } else {
            if (db[guildId].channelId !== channel.id) {
                db[guildId].channelId = channel.id;
                db[guildId].messageId = null; 
            }
        }

        db[guildId].entries.push({
            name: finalName,
            aniversarianteId: targetId, 
            day: day,
            month: month,
            year: year,
            requesterId: message.author.id, 
            lastNotifiedYear: 0
        });

        salvarDB(db);
        await message.reply(`✅ Registrado! **${finalName}** em **${day}/${month}**. Atualizando placar...`);
        
        await atualizarPlacar(message.client, guildId);
    }
};