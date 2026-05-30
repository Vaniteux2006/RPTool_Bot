import { SlashCommandBuilder, PermissionFlagsBits, Message, ChatInputCommandInteraction, GuildMember } from 'discord.js';

export default {
    name: 'unmute',
    description: 'Remove o castigo de um usuário.',
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove o timeout')
        .addUserOption(option => 
            option.setName('alvo')
                .setDescription('O usuário')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(message: Message, args: string[]) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('Sem permissão! ❌');
        }

        const target = message.mentions.members?.first();
        if (!target) return message.reply('Mencione alguém! 👤');

        if (!target.isCommunicationDisabled()) {
            return message.reply('Ele não está de castigo. 🤔');
        }

        try {
            await target.timeout(null);
            message.reply(`🗣️ **${target.user.tag}** está livre!`);
        } catch (error) {
            console.warn('[UNMUTE] Falha ao remover timeout:', target.user.tag, error);
            message.reply('Erro ao remover castigo.');
        }
    },

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getMember('alvo') as GuildMember;

        if (!target.isCommunicationDisabled()) {
            return interaction.reply({ content: 'Usuário não está mutado.', ephemeral: true });
        }

        try {
            await target.timeout(null);
            await interaction.reply(`🗣️ **${target.user.tag}** está livre!`);
        } catch (error) {
            console.warn('[UNMUTE] Falha ao desmutar via slash:', target.user.tag, error);
            await interaction.reply({ content: 'Erro ao desmutar.', ephemeral: true });
        }
    }
};