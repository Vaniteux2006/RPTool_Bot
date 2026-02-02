const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

function parseDuration(str) {
    if (!str) return null;
    const units = {
        's': 1000, 'segundo': 1000, 'segundos': 1000,
        'm': 60000, 'minuto': 60000, 'minutos': 60000,
        'h': 3600000, 'hora': 3600000, 'horas': 3600000,
        'd': 86400000, 'dia': 86400000, 'dias': 86400000,
        'w': 604800000, 'semana': 604800000, 'semanas': 604800000,
        'mês': 2592000000, 'meses': 2592000000,
        'y': 31536000000, 'ano': 31536000000, 'anos': 31536000000
    };
    const match = str.match(/^(\d+)\s*(.*)$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase().trim() || 'm';
    const multiplier = units[unit];
    return multiplier ? value * multiplier : null;
}

module.exports = {
    name: 'mute',
    description: 'Aplica timeout flexível.',
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Coloca um usuário de castigo')
        .addUserOption(o => o.setName('alvo').setDescription('O usuário').setRequired(true))
        .addStringOption(o => o.setName('tempo').setDescription('Ex: 1d, 10 minutos, 1y').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(message, args) {
        const target = message.mentions.members.first();
        const timeStr = args.slice(1).join(' ');
        const ms = parseDuration(timeStr);

        if (!target || !ms) return message.reply('Uso: rp!mute @user 10m');
        if (ms > 2419200000) return message.reply('O limite do Discord é 28 dias!');

        await target.timeout(ms);
        message.reply(`🤫 **${target.user.tag}** castigado por **${timeStr}**.`);
    },

    async executeSlash(interaction) {
        const target = interaction.options.getMember('alvo');
        const timeStr = interaction.options.getString('tempo');
        const ms = parseDuration(timeStr);

        if (!ms || ms > 2419200000) return interaction.reply({ content: 'Tempo inválido ou excede 28 dias.', ephemeral: true });

        await target.timeout(ms);
        await interaction.reply(`🤫 **${target.user.tag}** silenciado por **${timeStr}**.`);
    }
};