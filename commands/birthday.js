const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Caminho do arquivo JSON
const dbPath = path.join(__dirname, '../Data/birthdays.json');

// --- FUNÇÕES AUXILIARES DE BANCO DE DADOS ---
function lerDB() {
    try {
        if (!fs.existsSync(dbPath)) return {};
        const raw = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        return {};
    }
}

function salvarDB(data) {
    // Garante que a pasta existe
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
}

// --- LÓGICA DO PLACAR (O CORAÇÃO DO SISTEMA) ---
// Essa função checa o dia, checa a mensagem e atualiza tudo.
async function atualizarPlacar(client, guildId) {
    let db = lerDB();
    const config = db[guildId];

    if (!config || !config.channelId) return; // Nada configurado pra esse server

    // 1. Definições de Data e Hora
    const nowUTC = new Date();
    // Offset -3 (Brasil) padrão, mas poderia vir do config
    const tzOffset = -3; 
    const serverTime = new Date(nowUTC.getTime() + (tzOffset * 3600000) + (nowUTC.getTimezoneOffset() * 60000));
    
    const todayDay = serverTime.getDate();
    const todayMonth = serverTime.getMonth() + 1;
    const currentYear = serverTime.getFullYear();
    const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);

    // 2. Filtra quem faz aniversário HOJE
    const birthdaysToday = config.entries.filter(e => {
        if (e.day === todayDay && e.month === todayMonth) return true;
        // Lógica para nascidos em 29/02 em anos não bissextos (comemoram dia 28/02 ou 01/03, aqui pus 28)
        if (!isLeapYear && todayDay === 28 && todayMonth === 2 && e.day === 29 && e.month === 2) return true;
        return false;
    });

    // 3. Monta o Texto do Placar
    let newText = "📅 **Placar de Aniversários:**\nNenhum aniversariante hoje. O dia está tranquilo.";
    
    if (birthdaysToday.length > 0) {
        newText = "🎉 **HOJE É DIA DE FESTA!** 🎉\n\n";
        birthdaysToday.forEach(b => {
            let line = `🎂 **${b.name.toUpperCase()}**`;
            
            // Menciona o usuário se tiver ID válido (não for NPC)
            if (b.aniversarianteId && b.aniversarianteId.match(/^\d+$/)) {
                line += ` (<@${b.aniversarianteId}>)`;
            }

            if (b.day === 29 && b.month === 2 && !isLeapYear) line += " (Antecipado de 29/fev 🐸)";
            if (b.year) line += ` • Completando **${currentYear - b.year} anos**`;
            
            line += `\n*(Registrado por <@${b.requesterId}>)*`;
            newText += line + "\n";
        });
    }

    // 4. Manutenção da Mensagem (A Parte da Estabilidade)
    try {
        const channel = await client.channels.fetch(config.channelId);
        if (!channel) return; // Canal foi deletado, paciência

        let targetMsg = null;
        
        // Tenta achar a mensagem antiga
        if (config.messageId) {
            try {
                targetMsg = await channel.messages.fetch(config.messageId);
            } catch (e) {
                targetMsg = null; // Mensagem não existe mais (foi apagada)
            }
        }

        // Se não achou a mensagem, cria uma nova
        if (!targetMsg) {
            console.log(`[BIRTHDAY] Criando novo placar em ${guildId}...`);
            targetMsg = await channel.send(newText);
            config.messageId = targetMsg.id; // Salva o novo ID
            salvarDB(db); // Atualiza o JSON com o novo ID
        } else {
            // Se achou, só edita se o texto mudou (pra não gastar API)
            if (targetMsg.content !== newText) {
                await targetMsg.edit(newText);
            }
        }

        // 5. Enviar DM (Notificação) - Só envia 1 vez por ano
        for (const b of birthdaysToday) {
            if (b.lastNotifiedYear < currentYear) {
                try {
                    // Manda DM pro Requester avisando pra dar parabéns
                    const requester = await client.users.fetch(b.requesterId);
                    let dmMsg = `🎈 **PSIUU! Hoje é aniversário de ${b.name}!**\nVocê pediu pra eu avisar. Não esqueça de dar parabéns!`;
                    if (b.year) dmMsg += `\n(Fazendo ${currentYear - b.year} anos)`;
                    
                    await requester.send(dmMsg);
                    b.lastNotifiedYear = currentYear;
                    salvarDB(db); // Salva que já avisou esse ano
                } catch (e) {
                    // DM fechada ou usuário saiu
                }
            }
        }

    } catch (error) {
        console.error(`[BIRTHDAY ERROR] Server ${guildId}:`, error.message);
    }
}

// --- FUNÇÃO EXPORTADA PRO INDEX.JS ---
async function checkBirthdays(client) {
    const db = lerDB();
    for (const guildId in db) {
        // Roda a verificação para cada servidor configurado
        await atualizarPlacar(client, guildId);
    }
}


// --- COMANDOS E EXPORTS ---
module.exports = {
    name: 'birthday',
    description: 'Gerencia Aniversários (Check, Reset, Add)',
    checkBirthdays, // Exporta a função pro index.js usar no setInterval

    async execute(message, args) {
        const subCommand = args[0] ? args[0].toLowerCase() : null;
        const guildId = message.guild.id;

        // ==========================================================
        // 1. COMANDO: CHECK (Listar)
        // ==========================================================
        if (subCommand === 'check') {
            const db = lerDB();
            const config = db[guildId];

            if (!config || config.entries.length === 0) {
                return message.reply("📭 Ninguém faz aniversário neste servidor (ou o banco está vazio).");
            }

            // Ordena por Mês e Dia
            const sorted = config.entries.sort((a, b) => {
                if (a.month !== b.month) return a.month - b.month;
                return a.day - b.day;
            });

            // Monta a lista
            const listaTxt = sorted.map(e => {
                const yearStr = e.year ? `/${e.year}` : '';
                return `• **${e.day.toString().padStart(2, '0')}/${e.month.toString().padStart(2, '0')}${yearStr}** - ${e.name} (<@${e.requesterId}>)`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0xFF007F) // Rosa Choque
                .setTitle(`🎂 Lista de Aniversariantes - ${message.guild.name}`)
                .setDescription(listaTxt.substring(0, 4000)) // Limite do Discord
                .setFooter({ text: "Use rp!birthday Nome Data #canal para adicionar" });

            return message.reply({ embeds: [embed] });
        }

        // ==========================================================
        // 2. COMANDO: RESET (Zerar Tudo)
        // ==========================================================
        if (subCommand === 'reset') {
            // Permissão de Admin Necessária
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply("⛔ **Apenas Administradores podem resetar o sistema de aniversários.**");
            }

            let db = lerDB();
            if (!db[guildId]) return message.reply("⚠️ Não há nada para resetar aqui.");

            // Tenta apagar a mensagem de placar antiga pra não ficar lixo
            try {
                const canal = await message.guild.channels.fetch(db[guildId].channelId);
                const msg = await canal.messages.fetch(db[guildId].messageId);
                if (msg) await msg.delete();
            } catch (e) { /* Ignora se já não existe */ }

            delete db[guildId];
            salvarDB(db);

            return message.reply("💥 **Sistema resetado!** Todos os aniversários deste servidor foram apagados e o placar removido.");
        }

        // ==========================================================
        // 3. COMANDO: ADD (Adicionar Aniversário)
        // Sintaxe: rp!birthday Nome Data #canal
        // ==========================================================
        
        // A. Achar o canal (último argumento ou menção)
        const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[args.length - 1]);
        if (!channel) return message.reply("⚠️ **Erro:** Faltou o canal no final! Ex: `rp!birthday Bruno 15/09 #aniversarios`");

        // B. Achar a data (Regex busca DD/MM ou DD/MM/AAAA)
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

        // Validação básica de data
        if (month < 1 || month > 12 || day < 1 || day > 31) return message.reply("⚠️ **Erro:** Data impossível.");

        // C. O que sobrou é o Nome (Remove data e canal da lista)
        // Também detecta se o "Nome" é uma menção (@User) para salvar o ID do aniversariante
        const entries = args.filter((_, index) => index !== dateIndex && !args[index].includes(channel.id));
        const nameClean = entries.join(" ").replace(/<@!?\d+>/g, "").trim(); // Nome sem a menção
        
        let targetId = "NPC"; // ID padrão se for só texto
        const mentionedUser = message.mentions.users.first();
        
        // Se o usuário marcou alguém no "Nome", usamos o ID dele, senão usamos o nome limpo
        // Ex: rp!birthday @Vaniteux 20/05 -> ID do Vaniteux
        // Ex: rp!birthday Minha Mãe 20/05 -> ID "NPC"
        if (mentionedUser && args.join(" ").includes(mentionedUser.id)) {
            targetId = mentionedUser.id;
        }

        // Nome final pra exibição (Se não tiver texto limpo, usa o username do mencionado)
        const finalName = nameClean || (mentionedUser ? mentionedUser.username : "Desconhecido");

        // D. Salvar no Banco
        let db = lerDB();

        // Se o server não existe, cria a estrutura
        if (!db[guildId]) {
            db[guildId] = {
                serverId: guildId, // Redundante mas você pediu
                channelId: channel.id,
                messageId: null,
                entries: []
            };
        } else {
            // Se mudou o canal, atualiza
            if (db[guildId].channelId !== channel.id) {
                db[guildId].channelId = channel.id;
                db[guildId].messageId = null; // Força criar msg nova no novo canal
            }
        }

        // Adiciona a entrada
        db[guildId].entries.push({
            name: finalName,
            aniversarianteId: targetId, // ID do aniversariante
            day: day,
            month: month,
            year: year,
            requesterId: message.author.id, // ID de quem fez o comando
            lastNotifiedYear: 0
        });

        salvarDB(db);

        // E. Força atualização IMEDIATA do placar
        await message.reply(`✅ Registrado! **${finalName}** em **${day}/${month}**. Atualizando placar...`);
        
        // CORREÇÃO AQUI: Passamos 'message.client' em vez de 'client'
        await atualizarPlacar(message.client, guildId);
    }
};