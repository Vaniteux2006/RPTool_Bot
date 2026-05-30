"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    name: 'unban',
    description: 'Desbane um usuário pelo ID',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('unban')
        .setDescription('Remove o banimento de um usuário')
        .addStringOption(option => option.setName('id')
        .setDescription('O ID do usuário')
        .setRequired(true))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.BanMembers),
    async execute(message, args) {
        if (!message.member?.permissions.has(discord_js_1.PermissionFlagsBits.BanMembers)) {
            return message.reply('Sem permissão! ❌');
        }
        const userId = args[0];
        if (!userId)
            return message.reply('Forneça o ID! Ex: `rp!unban 123...`');
        try {
            await message.guild?.members.unban(userId);
            message.reply(`✅ ID **${userId}** desbanido!`);
        }
        catch (error) {
            message.reply('❌ Erro: ID inválido ou não banido.');
        }
    },
    async executeSlash(interaction) {
        const userId = interaction.options.getString('id');
        try {
            await interaction.guild?.members.unban(userId);
            await interaction.reply(`✅ ID **${userId}** desbanido!`);
        }
        catch (error) {
            await interaction.reply({ content: '❌ Erro ao desbanir.', ephemeral: true });
        }
    }
};
