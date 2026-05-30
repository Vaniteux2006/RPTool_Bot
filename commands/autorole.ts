// RPTool/commands/autorole.ts
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    GuildMember,
    Message,
} from 'discord.js';
import { AutoroleModel } from '../tools/models/AutoroleConfig';
import { EventCheckout } from '../tools/event_checkout';

const autorole = {
    name: 'autorole',
    description: 'Gerencia cargos automáticos ao entrar (add, del, list)',

    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Configura o sistema de cargos automáticos')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Adiciona um cargo ao autorole')
                .addRoleOption(opt =>
                    opt.setName('cargo').setDescription('Cargo a ser dado').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('del')
                .setDescription('Remove um cargo do autorole')
                .addRoleOption(opt =>
                    opt.setName('cargo').setDescription('Cargo a ser removido').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Lista os cargos configurados no autorole')),

    // ─── Lógica de negócio ────────────────────────────────────────────────────
    // Separada dos handlers de comando para poder ser chamada pelo EventCheckout.
    async giveRole(member: GuildMember): Promise<void> {
        try {
            const config = await AutoroleModel.findOne({ guildId: member.guild.id });
            if (!config?.autorole?.length) return;
            for (const roleId of config.autorole) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) await member.roles.add(role).catch(() => {});
            }
        } catch (e) {
            console.error('❌ [autorole] giveRole falhou:', e);
        }
    },

    // ─── Slash command (/autorole) ────────────────────────────────────────────
    executeSlash: async (interaction: ChatInputCommandInteraction) => {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        if (!guildId) return;

        let config = await AutoroleModel.findOne({ guildId });
        if (!config) config = new AutoroleModel({ guildId, autorole: [] });

        if (sub === 'add') {
            const role = interaction.options.getRole('cargo');
            if (!role) return;
            if (config.autorole.includes(role.id))
                return interaction.reply({ content: `⚠️ O cargo **${role.name}** já está na lista.`, ephemeral: true });
            config.autorole.push(role.id);
            await config.save();
            return interaction.reply(`✅ Cargo **${role.name}** adicionado ao Autorole.`);
        }

        if (sub === 'del') {
            const role = interaction.options.getRole('cargo');
            if (!role) return;
            if (!config.autorole.includes(role.id))
                return interaction.reply({ content: `⚠️ O cargo **${role.name}** não está configurado.`, ephemeral: true });
            config.autorole = config.autorole.filter((id: string) => id !== role.id);
            await config.save();
            return interaction.reply(`🗑️ Cargo **${role.name}** removido do Autorole.`);
        }

        if (sub === 'list') {
            if (!config.autorole?.length)
                return interaction.reply('📭 Nenhum cargo configurado para autorole.');
            return interaction.reply(`📋 **Cargos Automáticos:**\n${config.autorole.map((id: string) => `<@&${id}>`).join(', ')}`);
        }
    },

    // ─── Texto (rp!autorole add/del/list @cargo) ──────────────────────────────
    execute: async (message: Message, args: string[]) => {
        const sub     = args[0]?.toLowerCase();
        const guildId = message.guild?.id;
        if (!guildId) return;

        if (!sub || sub === 'help') {
            return message.reply(
                '⚙️ **Autorole — Comandos de Texto**\n' +
                '`rp!autorole add @cargo` — adiciona cargo ao autorole\n' +
                '`rp!autorole del @cargo` — remove cargo do autorole\n' +
                '`rp!autorole list` — lista os cargos configurados\n\n' +
                '-# Também disponível via `/autorole`',
            );
        }

        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator))
            return message.reply('❌ Apenas administradores podem gerenciar o autorole.');

        let config = await AutoroleModel.findOne({ guildId });
        if (!config) config = new AutoroleModel({ guildId, autorole: [] });

        if (sub === 'add') {
            const role = message.mentions.roles.first();
            if (!role) return message.reply('❌ Mencione o cargo! Ex: `rp!autorole add @Membro`');
            if (config.autorole.includes(role.id))
                return message.reply(`⚠️ O cargo **${role.name}** já está na lista.`);
            config.autorole.push(role.id);
            await config.save();
            return message.reply(`✅ Cargo **${role.name}** adicionado ao Autorole.`);
        }

        if (sub === 'del') {
            const role = message.mentions.roles.first();
            if (!role) return message.reply('❌ Mencione o cargo! Ex: `rp!autorole del @Membro`');
            if (!config.autorole.includes(role.id))
                return message.reply(`⚠️ O cargo **${role.name}** não está configurado.`);
            config.autorole = config.autorole.filter((id: string) => id !== role.id);
            await config.save();
            return message.reply(`🗑️ Cargo **${role.name}** removido do Autorole.`);
        }

        if (sub === 'list') {
            if (!config.autorole?.length)
                return message.reply('📭 Nenhum cargo configurado para autorole.');
            return message.reply(`📋 **Cargos Automáticos:**\n${config.autorole.map((id: string) => `<@&${id}>`).join(', ')}`);
        }

        return message.reply('❌ Subcomando inválido. Use `rp!autorole help`.');
    },
};

// ─── Auto-inscrição no EventCheckout ─────────────────────────────────────────
// Este bloco roda uma vez quando o módulo é carregado pelo loadCommands().
// Não precisa tocar no index.ts — se o arquivo for deletado, a inscrição some.
EventCheckout.onGuildMemberAdd('autorole', async (member: GuildMember) => {
    await autorole.giveRole(member);
});

export default autorole;
