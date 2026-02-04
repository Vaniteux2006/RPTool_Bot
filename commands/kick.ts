import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType,
    Message,
    ChatInputCommandInteraction,
    GuildMember,
    ButtonInteraction
} from 'discord.js';

export default {
    name: 'kick',
    description: 'Expulsa um usuário com confirmação.',
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulsa um usuário do servidor')
        .addUserOption(option => option.setName('alvo').setDescription('Usuário a ser expulso').setRequired(true))
        .addStringOption(option => option.setName('motivo').setDescription('Motivo da expulsão'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getMember('alvo') as GuildMember;
        const reason = interaction.options.getString('motivo') || 'Não informado';

        if (!target) return interaction.reply({ content: 'Usuário não encontrado.', ephemeral: true });
        if (!target.kickable) return interaction.reply({ content: 'Não posso expulsar este usuário.', ephemeral: true });

        await this.runConfirmation(interaction, target, reason, true);
    },

    async execute(message: Message, args: string[]) {
        if (!message.member?.permissions.has(PermissionFlagsBits.KickMembers)) return message.reply('Sem permissão! ❌');

        const target = message.mentions.members?.first();
        const reason = args.slice(1).join(' ') || 'Não informado';

        if (!target) return message.reply('Mencione alguém para expulsar! 👤');
        if (!target.kickable) return message.reply('Eu não tenho poder para expulsar este usuário. 🛡️');

        await this.runConfirmation(message, target, reason, false);
    },

    async runConfirmation(ctx: Message | ChatInputCommandInteraction, target: GuildMember, reason: string, isSlash: boolean) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('confirm_kick').setLabel('Sim, Expulsar').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_kick').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );

        const text = `⚠️ O usuário **${target.user.tag}** será expulso pelo motivo: \`${reason}\`. Tem certeza disso?`;
        
        const response = isSlash 
            ? await (ctx as ChatInputCommandInteraction).reply({ content: text, components: [row], fetchReply: true }) 
            : await (ctx as Message).reply({ content: text, components: [row] });

        const filter = (i: ButtonInteraction) => i.user.id === (isSlash ? ctx.member?.user.id : (ctx as Message).author.id);
        
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

        collector.on('end', (_: any, r: string) => {
            if (r === 'time') {
                if (isSlash) (ctx as ChatInputCommandInteraction).editReply({ content: '⏰ Tempo esgotado.', components: [] });
                else response.edit({ content: '⏰ Tempo esgotado.', components: [] });
            }
        });
    }
};