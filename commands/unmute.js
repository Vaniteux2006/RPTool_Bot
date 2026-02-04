const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'unmute',
    description: 'Remove o castigo de um usuário.',
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove o castigo (timeout) de um usuário')
        .addUserOption(option => 
            option.setName('alvo')
                .setDescription('O usuário a ser perdoado')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    // Prefixo: rp!unmute @usuario
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('Sem permissão! ❌');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('Mencione alguém para remover o castigo! 👤');

        if (!target.isCommunicationDisabled()) {
            return message.reply('Este usuário não está de castigo. 🤔');
        }

        try {
            await target.timeout(null); // null remove o timeout
            message.reply(`🗣️ **${target.user.tag}** foi liberado do castigo!`);
        } catch (error) {
            message.reply('Não consegui remover o castigo. Verifique meus cargos. 🛡️');
        }
    },

    // Slash: /unmute @usuario
    async executeSlash(interaction) {
        const target = interaction.options.getMember('alvo');

        if (!target.isCommunicationDisabled()) {
            return interaction.reply({ content: 'Este usuário não está de castigo. 🤔', ephemeral: true });
        }

        try {
            await target.timeout(null);
            await interaction.reply(`🗣️ **${target.user.tag}** foi liberado do castigo!`);
        } catch (error) {
            await interaction.reply({ content: 'Erro ao remover castigo. Verifique meus cargos. 🛡️', ephemeral: true });
        }
    }
};