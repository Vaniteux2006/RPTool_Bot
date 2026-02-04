import { PermissionFlagsBits, SlashCommandBuilder, GuildMember, Message, ChatInputCommandInteraction } from 'discord.js';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(__dirname, '../Data/server_config.json');

interface ServerConfig {
    server: string;
    autorole: string[];
}

function lerDB(): ServerConfig[] {
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

function salvarDB(data: ServerConfig[]) {
    try {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
    } catch (e) {
        console.error("❌ [AUTOROLE] Erro ao salvar DB:", e);
    }
}

export default {
    name: 'autorole',
    description: 'Gerencia cargos automáticos (add, del, zero, check)',

    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Gerencia o cargo automático de entrada')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('add').setDescription('Adiciona um cargo').addRoleOption(op => op.setName('cargo').setDescription('O cargo').setRequired(true)))
        .addSubcommand(sub => sub.setName('del').setDescription('Remove um cargo').addRoleOption(op => op.setName('cargo').setDescription('O cargo').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('Lista os cargos configurados')),

    // Função estática para ser chamada no evento 'guildMemberAdd' do index.ts
    async giveRole(member: GuildMember) {
        console.log(`\n🔍 [AUTOROLE] Verificando entrada de: ${member.user.tag}`);
        
        const db = lerDB();
        const serverConfig = db.find(entry => entry.server === member.guild.id);
        
        if (!serverConfig || !serverConfig.autorole?.length) return;

        for (const roleId of serverConfig.autorole) {
            try {
                let role = member.guild.roles.cache.get(roleId);
                if (!role) role = await member.guild.roles.fetch(roleId) || undefined;

                if (role) {
                    await member.roles.add(role);
                    console.log(`   -> ✅ Cargo [${role.name}] dado.`);
                }
            } catch (err) {
                console.error(`   -> ❌ Erro ao dar cargo ${roleId}.`);
            }
        }
    },

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const role = interaction.options.getRole('cargo');
        const guildId = interaction.guildId!;

        let db = lerDB();
        let config = db.find(e => e.server === guildId);

        if (!config) {
            config = { server: guildId, autorole: [] };
            db.push(config);
        }

        if (sub === 'add' && role) {
            if (config.autorole.includes(role.id)) {
                return interaction.reply("Esse cargo já está na lista.");
            }
            config.autorole.push(role.id);
            salvarDB(db);
            return interaction.reply(`✅ Cargo **${role.name}** adicionado ao Autorole.`);
        }

        if (sub === 'del' && role) {
            config.autorole = config.autorole.filter(id => id !== role.id);
            salvarDB(db);
            return interaction.reply(`🗑️ Cargo **${role.name}** removido.`);
        }

        if (sub === 'list') {
            const roles = config.autorole.map(id => `<@&${id}>`).join(', ') || "Nenhum";
            return interaction.reply(`📋 **Cargos Automáticos:** ${roles}`);
        }
    },

    // Mantendo execute para compatibilidade se necessário, mas focando no Slash
    async execute(message: Message, args: string[]) {
        message.reply("Use os comandos de barra (`/autorole`) para configurar.");
    }
};