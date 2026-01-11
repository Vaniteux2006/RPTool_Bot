const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Caminho para o JSON
const dbPath = path.join(__dirname, '../Data/server_config.json');

// Funções Auxiliares de Banco de Dados
function lerDB() {
    try {
        const raw = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(raw);
        // Garante que é um Array (se for o formato antigo {}, ele reseta pra [])
        return Array.isArray(data) ? data : []; 
    } catch (e) {
        return [];
    }
}

function salvarDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
}

module.exports = {
    name: 'autorole',
    description: 'Gerencia cargos automáticos (add, del, zero, check)',
    
    // --- PARTE 1: COMANDOS (rp!autorole) ---
    async execute(message, args) {
        // 1. Segurança: Só Admin mexe aqui
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ **Sem Permissão:** Apenas Administradores podem configurar o Autorole.");
        }

        const subCommand = args[0] ? args[0].toLowerCase() : null;
        const guildId = message.guild.id;

        // Carrega o banco
        let db = lerDB();
        
        // Procura a configuração deste servidor específico
        let serverConfig = db.find(entry => entry.server === guildId);

        // Se não existir, cria o esqueleto
        if (!serverConfig) {
            serverConfig = { server: guildId, autorole: [] };
            db.push(serverConfig);
        }

        // ======================================================
        // SUB-COMANDO: ADD (Adicionar Cargo)
        // ======================================================
        if (subCommand === 'add') {
            const role = message.mentions.roles.first();
            if (!role) return message.reply("⚠️ Uso: `rp!autorole add @cargo`");

            if (serverConfig.autorole.includes(role.id)) {
                return message.reply("⚠️ Esse cargo já está na lista de Autorole.");
            }

            serverConfig.autorole.push(role.id);
            salvarDB(db);
            return message.reply(`✅ **Adicionado:** O cargo **${role.name}** será dado aos novatos.`);
        }

        // ======================================================
        // SUB-COMANDO: DEL (Remover Cargo)
        // ======================================================
        else if (subCommand === 'del') {
            const role = message.mentions.roles.first();
            if (!role) return message.reply("⚠️ Uso: `rp!autorole del @cargo`");

            if (!serverConfig.autorole.includes(role.id)) {
                return message.reply("⚠️ Esse cargo não estava configurado.");
            }

            // Filtra removendo o ID do cargo
            serverConfig.autorole = serverConfig.autorole.filter(id => id !== role.id);
            salvarDB(db);
            return message.reply(`🗑️ **Removido:** O cargo **${role.name}** não será mais dado.`);
        }

        // ======================================================
        // SUB-COMANDO: ZERO (Resetar Tudo)
        // ======================================================
        else if (subCommand === 'zero') {
            // Remove o objeto do servidor do array principal
            db = db.filter(entry => entry.server !== guildId);
            salvarDB(db);
            return message.reply("💥 **Resetado!** Todas as configurações de Autorole deste servidor foram apagadas.");
        }

        // ======================================================
        // SUB-COMANDO: CHECK (Verificar Config)
        // ======================================================
        else if (subCommand === 'check') {
            if (serverConfig.autorole.length === 0) {
                return message.reply("📂 **Status:** Nenhum cargo configurado para Autorole.");
            }

            // Transforma IDs em Nomes
            const nomesCargos = serverConfig.autorole.map(roleId => {
                const role = message.guild.roles.cache.get(roleId);
                return role ? `• ${role.name}` : `• Cargo Deletado (${roleId})`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`📋 Autorole de ${message.guild.name}`)
                .setDescription(`**Cargos que serão dados:**\n${nomesCargos}`)
                .setFooter({ text: "Use rp!autorole del @cargo para remover." });

            return message.reply({ embeds: [embed] });
        }

        // ======================================================
        // AJUDA (Se não digitou nada certo)
        // ======================================================
        else {
            return message.reply(
                "**⚙️ Comandos do Autorole:**\n" +
                "`rp!autorole add @cargo` - Adiciona um cargo à lista\n" +
                "`rp!autorole del @cargo` - Remove um cargo da lista\n" +
                "`rp!autorole check` - Vê quais cargos estão configurados\n" +
                "`rp!autorole zero` - Desativa tudo e limpa a config"
            );
        }
    },

    // --- PARTE 2: AÇÃO AUTOMÁTICA (Chamada pelo index.js) ---
    async giveRole(member) {
        const db = lerDB();
        const serverConfig = db.find(entry => entry.server === member.guild.id);

        // Se não tem config ou a lista tá vazia, tchau
        if (!serverConfig || !serverConfig.autorole || serverConfig.autorole.length === 0) return;

        console.log(`[AUTOROLE] Processando entrada de ${member.user.tag}...`);

        for (const roleId of serverConfig.autorole) {
            try {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role);
                    console.log(`   -> Cargo ${role.name} adicionado.`);
                }
            } catch (err) {
                console.error(`   -> ❌ Erro ao dar cargo ${roleId}: Sem permissão ou cargo do bot é baixo.`);
            }
        }
    }
};