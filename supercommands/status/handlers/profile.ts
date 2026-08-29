// RPTool/supercommands/status/handlers/profile.ts
// ─── rp!status perfil @user ────────────────────────────────────────────────────
// Perfil temporal de um usuário: evolução, horário/dia favoritos, auge, alcance.
import { Message, EmbedBuilder } from 'discord.js';
import {
    fetchRange, monthlySeries, hourHistogram, weekdayHistogram, totalOf, sumMap,
    activeRange, lineChart, formatYM, formatDateBR, argMax, WEEKDAYS_FULL, fmt, userTopChannel,
} from './aggregate';

export async function handleProfile(message: Message, args: string[]): Promise<any> {
    const guildId = message.guild!.id;

    const targetUser = message.mentions?.users?.first() ?? null;
    let uid: string | undefined = targetUser?.id;
    if (!uid && args[1] && /^\d{17,20}$/.test(args[1])) uid = args[1];
    if (!uid) return message.reply('⚠️ Uso: `rp!status perfil @usuário` (ou com o ID).');

    const stats = await fetchRange(guildId);
    if (!stats.length) return message.reply('📉 Sem dados ainda.');

    const total = totalOf(stats, uid);
    if (total === 0) return message.reply('📉 Esse usuário não tem atividade registrada.');

    // Posição no ranking geral
    const ranking = Object.entries(sumMap(stats, 'users')).sort((a, b) => b[1] - a[1]);
    const pos = ranking.findIndex(([id]) => id === uid) + 1;

    const favHour = argMax(hourHistogram(stats, uid));
    const favWd = argMax(weekdayHistogram(stats, uid));
    const range = activeRange(stats, uid);
    const series = monthlySeries(stats, uid);
    const auge = series.reduce((a, b) => (b.total > a.total ? b : a), series[0]);

    const chart = await lineChart(series.map(p => formatYM(p.ym)), series.map(p => p.total), 'perfil.png');

    const name = targetUser?.username ?? `Usuário ${uid.slice(0, 6)}…`;
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`👤 Perfil de ${name}`)
        .setImage('attachment://perfil.png')
        .addFields(
            { name: 'Total de mensagens', value: `\`${fmt(total)}\``, inline: true },
            { name: 'Posição no servidor', value: pos > 0 ? `**#${pos}** de ${ranking.length}` : '—', inline: true },
            { name: '🚀 Mês de auge', value: `${formatYM(auge.ym)} (\`${fmt(auge.total)}\`)`, inline: true },
            { name: '⏰ Horário favorito', value: `**${favHour}h** (UTC)`, inline: true },
            { name: '📅 Dia favorito', value: `**${WEEKDAYS_FULL[favWd]}**`, inline: true },
            { name: '🕓 Ativo de', value: `${formatDateBR(range.first)} → ${formatDateBR(range.last)}`, inline: true },
        )
        .setFooter({ text: 'RPTool | Status • horários em UTC' });

    const favCh = await userTopChannel(guildId, uid);
    if (favCh) embed.addFields({ name: '💬 Canal favorito', value: `<#${favCh[0]}> (\`${fmt(favCh[1])}\`)`, inline: true });

    if (targetUser) embed.setThumbnail(targetUser.displayAvatarURL());
    return message.reply({ embeds: [embed], files: [chart] });
}
