"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// não mexa nisso. por algum motivo o código funciona mesmo sem existir a pasta
const dbPath = path_1.default.join(__dirname, '../../Data');
function lerDB() {
    try {
        if (!fs_1.default.existsSync(dbPath))
            return [];
        const raw = fs_1.default.readFileSync(dbPath, 'utf-8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    }
    catch (e) {
        console.error("❌ [AUTOROLE] Erro ao ler DB:", e);
        return [];
    }
}
function salvarDB(data) {
    try {
        const dir = path_1.default.dirname(dbPath);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.writeFileSync(dbPath, JSON.stringify(data, null, 4));
    }
    catch (e) {
        console.error("❌ [AUTOROLE] Erro ao salvar DB:", e);
    }
}
exports.default = {
    name: 'autorole',
    description: 'Gerencia cargos automáticos ao entrar (add, del, list)',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Configura cargos automáticos para novos membros')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub => sub.setName('add')
        .setDescription('Adiciona um cargo à lista de autorole')
        .addRoleOption(op => op.setName('cargo').setDescription('O cargo a ser dado').setRequired(true)))
        .addSubcommand(sub => sub.setName('del')
        .setDescription('Remove um cargo da lista de autorole')
        .addRoleOption(op => op.setName('cargo').setDescription('O cargo a ser removido').setRequired(true)))
        .addSubcommand(sub => sub.setName('list')
        .setDescription('Lista os cargos configurados atualmente')),
    async giveRole(member) {
        console.log(`\n🔍 [AUTOROLE] Verificando entrada de: ${member.user.tag} em ${member.guild.name}`);
        const db = lerDB();
        const config = db.find(entry => entry.server === member.guild.id);
        if (!config || !config.autorole || config.autorole.length === 0) {
            console.log(`   -> 🚫 Nenhum autorole configurado para este servidor.`);
            return;
        }
        console.log(`   -> 📜 Cargos a adicionar: ${config.autorole.length}`);
        for (const roleId of config.autorole) {
            try {
                const role = member.guild.roles.cache.get(roleId) || await member.guild.roles.fetch(roleId);
                if (role) {
                    await member.roles.add(role);
                    console.log(`   -> ✅ Cargo inserido: @${role.name}`);
                }
                else {
                    console.log(`   -> ⚠️ Cargo ID ${roleId} não encontrado no servidor.`);
                }
            }
            catch (err) {
                console.error(`   -> ❌ Erro ao dar cargo (${roleId}):`, err);
            }
        }
    },
    async executeSlash(interaction) {
        if (!interaction.guildId)
            return interaction.reply("Comando apenas para servidores.");
        const sub = interaction.options.getSubcommand();
        const db = lerDB();
        let config = db.find(e => e.server === interaction.guildId);
        if (!config) {
            config = { server: interaction.guildId, autorole: [] };
            db.push(config);
        }
        if (sub === 'add') {
            const role = interaction.options.getRole('cargo');
            if (!role)
                return;
            if (config.autorole.includes(role.id)) {
                return interaction.reply({ content: `⚠️ O cargo **${role.name}** já está na lista.`, ephemeral: true });
            }
            config.autorole.push(role.id);
            salvarDB(db);
            return interaction.reply(`✅ Cargo **${role.name}** adicionado ao Autorole.`);
        }
        if (sub === 'del') {
            const role = interaction.options.getRole('cargo');
            if (!role)
                return;
            if (!config.autorole.includes(role.id)) {
                return interaction.reply({ content: `⚠️ O cargo **${role.name}** não está configurado no Autorole.`, ephemeral: true });
            }
            config.autorole = config.autorole.filter(id => id !== role.id);
            salvarDB(db);
            return interaction.reply(`🗑️ Cargo **${role.name}** removido do Autorole.`);
        }
        if (sub === 'list') {
            if (config.autorole.length === 0) {
                return interaction.reply("📭 Nenhum cargo configurado para autorole.");
            }
            const rolesMentions = config.autorole.map(id => `<@&${id}>`).join(', ');
            return interaction.reply(`📋 **Cargos Automáticos:**\n${rolesMentions}`);
        }
    },
    async execute(message, args) {
        message.reply("⚠️ Por favor, use `/autorole` (Slash Command) para configurar isso.");
    }
};
