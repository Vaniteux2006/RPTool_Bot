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
    ButtonInteraction,
    User
} from 'discord.js';

export default {
    name: 'ban',
    description: 'Bane um usuário por Menção ou ID (mesmo fora do servidor).',
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bane um usuário do servidor')
        .addUserOption(option => option.setName('alvo').setDescription('Usuário ou ID a ser banido').setRequired(true))
        .addStringOption(option => option.setName('motivo').setDescription('Motivo do banimento'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const targetUser = interaction.options.getUser('alvo', true);
        const reason = interaction.options.getString('motivo') || 'Não informado';

        const member = interaction.guild?.members.cache.get(targetUser.id);
        if (member && !member.bannable) {
            return interaction.reply({ content: '❌ Não posso banir este usuário (Cargos superiores ou iguais ao meu).', ephemeral: true });
        }

        await this.runConfirmation(interaction, targetUser, reason, true);
    },

    async execute(message: Message, args: string[]) {
        if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('Sem permissão! ❌');
        if (!args[0]) return message.reply('Mencione alguém ou coloque um ID para banir! 👤');

        let targetUser: User | undefined;
        const reason = args.slice(1).join(' ') || 'Não informado';

        if (message.mentions.users.size > 0) {
            targetUser = message.mentions.users.first();
        } 
        else if (/^\d{17,19}$/.test(args[0])) {
            try {
                targetUser = await message.client.users.fetch(args[0]);
            } catch (error) {
                console.warn('[BAN] Usuário não encontrado pelo ID:', args[0], error);
                return message.reply('❌ Usuário não encontrado com esse ID.');
            }
        }

        if (!targetUser) return message.reply('Usuário inválido! Mencione ou use um ID válido.');

        const member = message.guild?.members.cache.get(targetUser.id);
        if (member && !member.bannable) {
            return message.reply('❌ Não posso banir este usuário (Cargos superiores ou iguais ao meu).');
        }

        await this.runConfirmation(message, targetUser, reason, false);
    },

    async runConfirmation(ctx: Message | ChatInputCommandInteraction, targetUser: User, reason: string, isSlash: boolean) {
        if (!ctx.guild) return;

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('confirm_ban').setLabel('Sim, Banir').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_ban').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );

        const text = `⚠️ O usuário **${targetUser.tag}** (ID: ${targetUser.id}) será banido pelo motivo: \`${reason}\`.\nEle está ${ctx.guild.members.cache.has(targetUser.id) ? 'no servidor' : 'fora do servidor'}.\nTem certeza disso?`;
        
        const response = isSlash 
            ? await (ctx as ChatInputCommandInteraction).reply({ content: text, components: [row], fetchReply: true }) 
            : await (ctx as Message).reply({ content: text, components: [row] });

        const filter = (i: ButtonInteraction) => i.user.id === (isSlash ? ctx.member?.user.id : (ctx as Message).author.id);
        
        const collector = response.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_ban') {
                try {
                    await ctx.guild!.members.ban(targetUser.id, { reason });
                    await i.update({ content: `✅ **${targetUser.tag}** foi banido com sucesso!`, components: [] });
                } catch (error) {
                    console.error(error);
                    await i.update({ content: `❌ Erro ao banir. Verifique minhas permissões.`, components: [] });
                }
            } else {
                await i.update({ content: '❌ Banimento cancelado.', components: [] });
            }
            collector.stop();
        });

        collector.on('end', (_: any, r: string) => {
            if (r === 'time') {
                if (isSlash) (ctx as ChatInputCommandInteraction).editReply({ content: '⏰ Tempo esgotado.', components: [] }).catch(() => {});
                else response.edit({ content: '⏰ Tempo esgotado.', components: [] }).catch(() => {});
            }
        });
    }
};