const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'kick',
    description: 'Expulsa um usuário com confirmação.',
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulsa um usuário do servidor')
        .addUserOption(option => option.setName('alvo').setDescription('Usuário a ser expulso').setRequired(true))
        .addStringOption(option => option.setName('motivo').setDescription('Motivo da expulsão'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return message.reply('Sem permissão! ❌');

        const target = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'Não informado';

        if (!target) return message.reply('Mencione alguém para expulsar! 👤');
        if (!target.kickable) return message.reply('Eu não tenho poder para expulsar este usuário. 🛡️');

        await this.runConfirmation(message, target, reason, false);
    },

    async executeSlash(interaction) {
        const target = interaction.options.getMember('alvo');
        const reason = interaction.options.getString('motivo') || 'Não informado';

        if (!target.kickable) return interaction.reply({ content: 'Não posso expulsar este usuário.', ephemeral: true });

        await this.runConfirmation(interaction, target, reason, true);
    },

    async runConfirmation(ctx, target, reason, isSlash) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_kick').setLabel('Sim, Expulsar').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_kick').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );

        const text = `⚠️ O usuário **${target.user.tag}** será expulso pelo motivo: \`${reason}\`. Tem certeza disso?`;
        
        const response = isSlash 
            ? await ctx.reply({ content: text, components: [row], fetchReply: true }) 
            : await ctx.reply({ content: text, components: [row] });

        const filter = i => i.user.id === (isSlash ? ctx.user.id : ctx.author.id);
        
        const collector = response.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_kick') {
                await target.kick(reason);
                await i.update({ content: `✅ **${target.user.tag}** foi expulso.`, components: [] });
            } else {
                await i.update({ content: '❌ Expulsão cancelada.', components: [] });
            }
            collector.stop();
        });

        collector.on('end', (_, r) => {
            if (r === 'time') {
                const finalContent = '⏰ Tempo esgotado. Expulsão cancelada.';
                if (isSlash) ctx.editReply({ content: finalContent, components: [] });
                else response.edit({ content: finalContent, components: [] });
            }
        });
    }
};