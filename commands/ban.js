const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'ban',
    description: 'Bane um usuário com confirmação.',
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bane um usuário do servidor')
        .addUserOption(option => option.setName('alvo').setDescription('Usuário a ser banido').setRequired(true))
        .addStringOption(option => option.setName('motivo').setDescription('Motivo do banimento'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(message, args) {
        const target = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'Não informado';

        if (!target) return message.reply('Mencione alguém para banir! 👤');
        if (!target.bannable) return message.reply('Não posso banir este usuário. 🛡️');

        await this.runConfirmation(message, target, reason, false);
    },

    async executeSlash(interaction) {
        const target = interaction.options.getMember('alvo');
        const reason = interaction.options.getString('motivo') || 'Não informado';

        if (!target.bannable) return interaction.reply({ content: 'Não posso banir este usuário.', ephemeral: true });

        await this.runConfirmation(interaction, target, reason, true);
    },

    async runConfirmation(ctx, target, reason, isSlash) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm').setLabel('Sim, Banir').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );

        const text = `⚠️ O usuário **${target.user.tag}** será banido pelo motivo: \`${reason}\`. Tem certeza disso?`;
        
        const response = isSlash ? await ctx.reply({ content: text, components: [row], fetchReply: true }) : await ctx.reply({ content: text, components: [row] });

        const filter = i => i.user.id === (isSlash ? ctx.user.id : ctx.author.id);
        const collector = response.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm') {
                await target.ban({ reason });
                await i.update({ content: `✅ **${target.user.tag}** foi banido.`, components: [] });
            } else {
                await i.update({ content: '❌ Banimento cancelado.', components: [] });
            }
            collector.stop();
        });

        collector.on('end', (_, r) => {
            if (r === 'time') (isSlash ? ctx.editReply : response.edit).call(isSlash ? ctx : response, { content: '⏰ Tempo esgotado. Banimento cancelado.', components: [] });
        });
    }
};