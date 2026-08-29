import { SlashCommandBuilder, PermissionFlagsBits, Message, ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { parseDuration } from '../tools/utils/date';

export default {
    name: 'mute',
    description: 'Aplica timeout flexível.',
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Coloca um usuário de castigo')
        .addUserOption(o => o.setName('alvo').setDescription('O usuário').setRequired(true))
        .addStringOption(o => o.setName('tempo').setDescription('Ex: 1d, 10 minutos, 1y').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getMember('alvo') as GuildMember;
        const timeStr = interaction.options.getString('tempo') || "";
        const ms = parseDuration(timeStr);

        if (!ms || ms > 2419200000) { 
            return interaction.reply({ content: 'Tempo inválido ou maior que 28 dias.', flags: MessageFlags.Ephemeral });
        }
        if (!target) return interaction.reply("Usuário não encontrado.");

        await target.timeout(ms);
        await interaction.reply(`🤫 **${target.user.tag}** castigado por **${timeStr}**.`);
    },

    async execute(message: Message, args: string[]) {
        const target = message.mentions.members?.first();
        const timeStr = args.slice(1).join(' ');
        const ms = parseDuration(timeStr);

        if (!target || !ms) return message.reply('Uso: rp!mute @user 10m');
        if (ms > 2419200000) return message.reply('O limite do Discord é 28 dias!');

        await target.timeout(ms);
        message.reply(`🤫 **${target.user.tag}** castigado por **${timeStr}**.`);
    }
};