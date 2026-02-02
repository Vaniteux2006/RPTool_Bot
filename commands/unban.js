const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'unban',
    description: 'Remove o banimento de um usuário.',
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Remove o banimento de um usuário')
        .addStringOption(option => 
            option.setName('id')
                .setDescription('O ID do usuário a ser desbanido')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // Prefixo: rp!unban <ID>
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('Sem permissão! ❌');
        }

        const userId = args[0];
        if (!userId) return message.reply('Por favor, forneça o ID do usuário para desbanir. Ex: `rp!unban 123456789`');

        try {
            await message.guild.members.unban(userId);
            message.reply(`✅ O usuário com ID **${userId}** foi desbanido!`);
        } catch (error) {
            message.reply('❌ Não encontrei esse banimento ou o ID é inválido.');
        }
    },

    // Slash: /unban <ID>
    async executeSlash(interaction) {
        const userId = interaction.options.getString('id');

        try {
            await interaction.guild.members.unban(userId);
            await interaction.reply(`✅ O usuário com ID **${userId}** foi desbanido!`);
        } catch (error) {
            await interaction.reply({ content: '❌ Não encontrei esse banimento ou o ID é inválido.', ephemeral: true });
        }
    }
};