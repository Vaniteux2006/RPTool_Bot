"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    name: 'kick',
    description: 'Expulsa um usuário com confirmação.',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulsa um usuário do servidor')
        .addUserOption(option => option.setName('alvo').setDescription('Usuário a ser expulso').setRequired(true))
        .addStringOption(option => option.setName('motivo').setDescription('Motivo da expulsão'))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.KickMembers),
    async executeSlash(interaction) {
        const target = interaction.options.getMember('alvo');
        const reason = interaction.options.getString('motivo') || 'Não informado';
        if (!target)
            return interaction.reply({ content: 'Usuário não encontrado.', ephemeral: true });
        if (!target.kickable)
            return interaction.reply({ content: 'Não posso expulsar este usuário.', ephemeral: true });
        await this.runConfirmation(interaction, target, reason, true);
    },
    async execute(message, args) {
        if (!message.member?.permissions.has(discord_js_1.PermissionFlagsBits.KickMembers))
            return message.reply('Sem permissão! ❌');
        const target = message.mentions.members?.first();
        const reason = args.slice(1).join(' ') || 'Não informado';
        if (!target)
            return message.reply('Mencione alguém para expulsar! 👤');
        if (!target.kickable)
            return message.reply('Eu não tenho poder para expulsar este usuário. 🛡️');
        await this.runConfirmation(message, target, reason, false);
    },
    async runConfirmation(ctx, target, reason, isSlash) {
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('confirm_kick').setLabel('Sim, Expulsar').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId('cancel_kick').setLabel('Cancelar').setStyle(discord_js_1.ButtonStyle.Secondary));
        const text = `⚠️ O usuário **${target.user.tag}** será expulso pelo motivo: \`${reason}\`. Tem certeza disso?`;
        const response = isSlash
            ? await ctx.reply({ content: text, components: [row], fetchReply: true })
            : await ctx.reply({ content: text, components: [row] });
        const filter = (i) => i.user.id === (isSlash ? ctx.member?.user.id : ctx.author.id);
        const collector = response.createMessageComponentCollector({ filter, componentType: discord_js_1.ComponentType.Button, time: 60000 });
        collector.on('collect', async (i) => {
            if (i.customId === 'confirm_kick') {
                await target.kick(reason);
                await i.update({ content: `✅ **${target.user.tag}** foi expulso.`, components: [] });
            }
            else {
                await i.update({ content: '❌ Expulsão cancelada.', components: [] });
            }
            collector.stop();
        });
        collector.on('end', (_, r) => {
            if (r === 'time') {
                if (isSlash)
                    ctx.editReply({ content: '⏰ Tempo esgotado.', components: [] });
                else
                    response.edit({ content: '⏰ Tempo esgotado.', components: [] });
            }
        });
    }
};
