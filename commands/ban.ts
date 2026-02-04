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
    name: 'ban',
    description: 'Bane um usuário com confirmação.',
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bane um usuário do servidor')
        .addUserOption(option => option.setName('alvo').setDescription('Usuário a ser banido').setRequired(true))
        .addStringOption(option => option.setName('motivo').setDescription('Motivo do banimento'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getMember('alvo') as GuildMember;
        const reason = interaction.options.getString('motivo') || 'Não informado';

        if (!target) return interaction.reply({ content: 'Usuário não encontrado.', ephemeral: true });
        if (!target.bannable) return interaction.reply({ content: 'Não posso banir este usuário (Cargos superiores?).', ephemeral: true });

        await this.runConfirmation(interaction, target, reason, true);
    },

    async execute(message: Message, args: string[]) {
        if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('Sem permissão! ❌');

        const target = message.mentions.members?.first();
        const reason = args.slice(1).join(' ') || 'Não informado';

        if (!target) return message.reply('Mencione alguém para banir! 👤');
        if (!target.bannable) return message.reply('Não posso banir este usuário. 🛡️');

        await this.runConfirmation(message, target, reason, false);
    },

    async runConfirmation(ctx: Message | ChatInputCommandInteraction, target: GuildMember, reason: string, isSlash: boolean) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('confirm').setLabel('Sim, Banir').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );

        const text = `⚠️ O usuário **${target.user.tag}** será banido pelo motivo: \`${reason}\`. Tem certeza disso?`;
        
        const response = isSlash 
            ? await (ctx as ChatInputCommandInteraction).reply({ content: text, components: [row], fetchReply: true }) 
            : await (ctx as Message).reply({ content: text, components: [row] });

        const filter = (i: ButtonInteraction) => i.user.id === (isSlash ? ctx.member?.user.id : (ctx as Message).author.id);
        
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

        collector.on('end', (_: any, r: string) => {
            if (r === 'time') {
                if (isSlash) (ctx as ChatInputCommandInteraction).editReply({ content: '⏰ Tempo esgotado.', components: [] });
                else response.edit({ content: '⏰ Tempo esgotado.', components: [] });
            }
        });
    }
};