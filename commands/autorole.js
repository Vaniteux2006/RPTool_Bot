const { PermissionFlagsBits, EmbedBuilder, SlashCommandBuilder, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../Data/server_config.json');

function lerDB() {
    try {
        if (!fs.existsSync(dbPath)) return [];
        const raw = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : []; 
    } catch (e) { 
        console.error("❌ [AUTOROLE] Erro ao ler DB:", e);
        return []; 
    }
}

function salvarDB(data) {
    try {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
    } catch (e) {
        console.error("❌ [AUTOROLE] Erro ao salvar DB:", e);
    }
}

module.exports = {
    name: 'autorole',
    description: 'Gerencia cargos automáticos (add, del, zero, check)',

    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Gerencia o cargo automático de entrada')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('add').setDescription('Define o cargo').addRoleOption(op => op.setName('cargo').setDescription('Cargo').setRequired(true)))
        .addSubcommand(sub => sub.setName('del').setDescription('Remove o cargo').addRoleOption(op => op.setName('cargo').setDescription('Cargo').setRequired(true)))
        .addSubcommand(sub => sub.setName('check').setDescription('Verifica configuração'))
        .addSubcommand(sub => sub.setName('zero').setDescription('Reseta tudo')),
    
    async executeSlash(interaction) {
        await interaction.deferReply();
        const sub = interaction.options.getSubcommand();
        const args = [sub];
        const roleTemp = interaction.options.getRole('cargo');

        const fakeMessage = {
            author: interaction.user,
            member: interaction.member,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (payload) => interaction.editReply(payload),
            mentions: { roles: new Collection() }
        };

        if (roleTemp) fakeMessage.mentions.roles.set(roleTemp.id, roleTemp);

        await this.execute(fakeMessage, args);
    },

    async execute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ **Sem Permissão:** Apenas Administradores podem configurar o Autorole.");
        }

        const subCommand = args[0] ? args[0].toLowerCase() : null;
        const guildId = message.guild.id;

        let db = lerDB();
        let serverConfig = db.find(entry => entry.server === guildId);

        if (!serverConfig) {
            serverConfig = { server: guildId, autorole: [] };
            db.push(serverConfig);
        }

        if (subCommand === 'add') {
            const role = message.mentions.roles.first();
            if (!role) return message.reply("⚠️ Uso: `rp!autorole add @cargo`");

            if (serverConfig.autorole.includes(role.id)) {
                return message.reply("⚠️ Esse cargo já está na lista de Autorole.");
            }

            // SEGURANÇA: Verifica se o bot pode dar esse cargo
            if (role.position >= message.guild.members.me.roles.highest.position) {
                return message.reply("❌ **Erro:** Eu não posso dar esse cargo! Ele é maior ou igual ao meu cargo.");
            }

            serverConfig.autorole.push(role.id);
            salvarDB(db);
            return message.reply(`✅ **Adicionado:** O cargo **${role.name}** será dado aos novatos.`);
        }

        else if (subCommand === 'del') {
            const role = message.mentions.roles.first();
            if (!role) return message.reply("⚠️ Uso: `rp!autorole del @cargo`");

            if (!serverConfig.autorole.includes(role.id)) {
                return message.reply("⚠️ Esse cargo não estava configurado.");
            }

            serverConfig.autorole = serverConfig.autorole.filter(id => id !== role.id);
            salvarDB(db);
            return message.reply(`🗑️ **Removido:** O cargo **${role.name}** não será mais dado.`);
        }

        else if (subCommand === 'zero') {
            db = db.filter(entry => entry.server !== guildId);
            salvarDB(db);
            return message.reply("💥 **Resetado!** Todas as configurações de Autorole deste servidor foram apagadas.");
        }

        else if (subCommand === 'check') {
            if (serverConfig.autorole.length === 0) {
                return message.reply("📂 **Status:** Nenhum cargo configurado para Autorole.");
            }

            const nomesCargos = serverConfig.autorole.map(roleId => {
                const role = message.guild.roles.cache.get(roleId);
                return role ? `• ${role.name}` : `• Cargo Deletado (${roleId})`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`📋 Autorole de ${message.guild.name}`)
                .setDescription(`**Cargos que serão dados:**\n${nomesCargos}`)
                .setFooter({ text: `Use rp!autorole del @cargo para remover • RPTool v1.2` });

            return message.reply({ embeds: [embed] });
        }
        else {
            return message.reply(
                "**⚙️ Comandos do Autorole:**\n" +
                "`rp!autorole add @cargo`\n`rp!autorole del @cargo`\n`rp!autorole check`\n`rp!autorole zero`"
            );
        }
    },

    // --- A FUNÇÃO MÁGICA QUE DÁ O CARGO ---
    async giveRole(member) {
        console.log(`\n🔍 [AUTOROLE] Verificando entrada de: ${member.user.tag} no server ${member.guild.name}`);
        
        const db = lerDB();
        const serverConfig = db.find(entry => entry.server === member.guild.id);
        
        if (!serverConfig) {
            console.log("   -> ❌ Nenhuma config encontrada para este servidor.");
            return;
        }

        if (!serverConfig.autorole || serverConfig.autorole.length === 0) {
            console.log("   -> ⚠️ Config existe, mas a lista de cargos está vazia.");
            return;
        }

        for (const roleId of serverConfig.autorole) {
            try {
                // Tenta pegar do cache ou buscar na API se não tiver
                let role = member.guild.roles.cache.get(roleId);
                if (!role) role = await member.guild.roles.fetch(roleId);

                if (role) {
                    await member.roles.add(role);
                    console.log(`   -> ✅ SUCESSO: Cargo [${role.name}] dado para ${member.user.tag}.`);
                } else {
                    console.log(`   -> ⚠️ AVISO: Cargo ID ${roleId} não existe mais no servidor.`);
                }
            } catch (err) {
                console.error(`   -> ❌ ERRO AO DAR CARGO:`);
                if (err.code === 50013) console.error("      Motivo: Sem permissão (Meu cargo é menor que o cargo que tento dar).");
                else console.error(err);
            }
        }
    }
};