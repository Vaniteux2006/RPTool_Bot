import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember } from 'discord.js';
import { AutoroleModel } from '../tools/models/AutoroleConfig'; 

export default {
    name: 'autorole',
    description: 'Gerencia cargos automáticos ao entrar (add, del, list)',
    
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Configura o sistema de cargos automáticos')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('add')
                .setDescription('Adiciona um cargo ao autorole')
                .addRoleOption(opt => opt.setName('cargo').setDescription('Cargo a ser dado').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('del')
                .setDescription('Remove um cargo do autorole')
                .addRoleOption(opt => opt.setName('cargo').setDescription('Cargo a ser removido').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('list')
                .setDescription('Lista os cargos configurados no autorole')),

    execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        if (!guildId) return;

        // 🔍 Busca as configurações no MongoDB, ou cria uma nova se não existir
        let config = await AutoroleModel.findOne({ guildId });
        if (!config) {
            config = new AutoroleModel({ guildId, autorole: [] });
        }

        if (sub === 'add') {
            const role = interaction.options.getRole('cargo');
            if (!role) return;

            if (config.autorole.includes(role.id)) {
                return interaction.reply({ content: `⚠️ O cargo **${role.name}** já está na lista.`, ephemeral: true });
            }

            // Adiciona e salva na nuvem ☁️
            config.autorole.push(role.id);
            await config.save();
            return interaction.reply(`✅ Cargo **${role.name}** adicionado ao Autorole.`);
        }

        if (sub === 'del') {
            const role = interaction.options.getRole('cargo');
            if (!role) return;

            if (!config.autorole.includes(role.id)) {
                return interaction.reply({ content: `⚠️ O cargo **${role.name}** não está configurado.`, ephemeral: true });
            }

            // Remove e salva na nuvem ☁️
            config.autorole = config.autorole.filter(id => id !== role.id);
            await config.save();
            return interaction.reply(`🗑️ Cargo **${role.name}** removido do Autorole.`);
        }

        if (sub === 'list') {
            if (!config.autorole || config.autorole.length === 0) {
                return interaction.reply("📭 Nenhum cargo configurado para autorole.");
            }
            const rolesMentions = config.autorole.map(id => `<@&${id}>`).join(', ');
            return interaction.reply(`📋 **Cargos Automáticos:**\n${rolesMentions}`);
        }
    },

    // ⚙️ A mágica que dá o cargo quando o membro entra
    giveRole: async (member: GuildMember) => {
        // Puxa direto do MongoDB ☁️
        const config = await AutoroleModel.findOne({ guildId: member.guild.id });
        
        if (!config || !config.autorole || config.autorole.length === 0) return;

        console.log(`⚙️ [AUTOROLE] Processando cargos para o novo membro: ${member.user.tag}`);

        for (const roleId of config.autorole) {
            const role = member.guild.roles.cache.get(roleId);
            if (role) {
                try {
                    await member.roles.add(role);
                    console.log(`✅ [AUTOROLE] Cargo ${role.name} dado com sucesso para ${member.user.tag}.`);
                } catch (e) {
                    console.error(`❌ [AUTOROLE] FALHA! Não consegui dar o cargo ${role.name}. O BOT TEM PERMISSÃO E ESTÁ ACIMA NA HIERARQUIA?`);
                }
            }
        }
    }
};