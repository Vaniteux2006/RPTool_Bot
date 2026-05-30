"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    name: 'unmute',
    description: 'Remove o castigo de um usuário.',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove o timeout')
        .addUserOption(option => option.setName('alvo')
        .setDescription('O usuário')
        .setRequired(true))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers),
    async execute(message, args) {
        if (!message.member?.permissions.has(discord_js_1.PermissionFlagsBits.ModerateMembers)) {
            return message.reply('Sem permissão! ❌');
        }
        const target = message.mentions.members?.first();
        if (!target)
            return message.reply('Mencione alguém! 👤');
        if (!target.isCommunicationDisabled()) {
            return message.reply('Ele não está de castigo. 🤔');
        }
        try {
            await target.timeout(null);
            message.reply(`🗣️ **${target.user.tag}** está livre!`);
        }
        catch (error) {
            message.reply('Erro ao remover castigo.');
        }
    },
    async executeSlash(interaction) {
        const target = interaction.options.getMember('alvo');
        if (!target.isCommunicationDisabled()) {
            return interaction.reply({ content: 'Usuário não está mutado.', ephemeral: true });
        }
        try {
            await target.timeout(null);
            await interaction.reply(`🗣️ **${target.user.tag}** está livre!`);
        }
        catch (error) {
            await interaction.reply({ content: 'Erro ao desmutar.', ephemeral: true });
        }
    }
};
