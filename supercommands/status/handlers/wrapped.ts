// RPTool/supercommands/status/handlers/wrapped.ts
// ─── rp!status wrapped [ano] [@user] ───────────────────────────────────────────
// Retrospectiva estilo "Wrapped" do servidor (ou de um usuário) em um ano ou em
// todo o histórico.
import { Message, EmbedBuilder } from 'discord.js';
import { truncarCampo } from '../../../tools/utils/discord/embed';
import {
    fetchRange, totalOf, sumMap, topN, hourHistogram, weekdayHistogram, peakDay,
    monthlySeries, argMax, WEEKDAYS_FULL, formatYM, formatDateBR, fmt, userTopChannel,
} from './aggregate';

export async function handleWrapped(message: Message, args: string[]): Promise<any> {
    const guildId = message.guild!.id;

    const targetUser = message.mentions?.users?.first() ?? null;
    let uid: string | undefined = targetUser?.id;
    if (!uid && args.find(a => /^\d{17,20}$/.test(a))) uid = args.find(a => /^\d{17,20}$/.test(a));

    const yearArg = args.find(a => /^\d{4}$/.test(a));
    const year = yearArg ? +yearArg : null;
    const fromISO = year ? `${year}-01-01` : undefined;
    const toISO = year ? `${year}-12-31` : undefined;
    const periodo = year ? `${year}` : 'Todos os Tempos';

    const stats = await fetchRange(guildId, fromISO, toISO);
    if (!stats.length) return message.reply(year ? `📉 Não tenho dados de **${year}**.` : '📉 Sem dados ainda.');

    const diasComDados = new Set(stats.map(s => s.date)).size;
    const peak = peakDay(stats, uid);

    // ─── Wrapped de USUÁRIO ───────────────────────────────────────────────────
    if (uid) {
        const total = totalOf(stats, uid);
        if (total === 0) return message.reply(`📉 Esse usuário não tem atividade${year ? ` em ${year}` : ''}.`);

        const serverTotal = totalOf(stats);
        const pct = serverTotal ? (total / serverTotal) * 100 : 0;
        const ranking = Object.entries(sumMap(stats, 'users')).sort((a, b) => b[1] - a[1]);
        const pos = ranking.findIndex(([id]) => id === uid) + 1;
        const favHour = argMax(hourHistogram(stats, uid));
        const favWd = argMax(weekdayHistogram(stats, uid));
        const series = monthlySeries(stats, uid);
        const auge = series.reduce((a, b) => (b.total > a.total ? b : a), series[0]);

        const name = targetUser?.username ?? `Usuário ${uid.slice(0, 6)}…`;
        const embed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(`✨ Wrapped ${periodo} — ${name}`)
            .setDescription(`A retrospectiva de **${name}** ${year ? `em **${year}**` : 'em toda a história'}.`)
            .addFields(
                { name: '📨 Mensagens', value: `\`${fmt(total)}\``, inline: true },
                { name: '🌐 Do servidor', value: `**${pct.toFixed(1)}%**`, inline: true },
                { name: '🏅 Posição', value: pos > 0 ? `**#${pos}** de ${ranking.length}` : '—', inline: true },
                { name: '⏰ Horário favorito', value: `**${favHour}h** (UTC)`, inline: true },
                { name: '📅 Dia favorito', value: `**${WEEKDAYS_FULL[favWd]}**`, inline: true },
                { name: '🚀 Mês de auge', value: `${formatYM(auge.ym)}`, inline: true },
            )
            .setFooter({ text: 'RPTool | Wrapped' });

        const favCh = await userTopChannel(guildId, uid);
        if (favCh) embed.addFields({ name: '💬 Canal favorito', value: `<#${favCh[0]}>`, inline: true });
        if (targetUser) embed.setThumbnail(targetUser.displayAvatarURL());
        return message.reply({ embeds: [embed] });
    }

    // ─── Wrapped do SERVIDOR ──────────────────────────────────────────────────
    const total = totalOf(stats);
    const media = diasComDados ? Math.round(total / diasComDados) : 0;
    const favHour = argMax(hourHistogram(stats));
    const favWd = argMax(weekdayHistogram(stats));

    const topUsers = topN(sumMap(stats, 'users'), 5).map(([id, c], i) => `**${i + 1}.** <@${id}> — \`${fmt(c)}\``).join('\n') || '—';
    const topChannels = topN(sumMap(stats, 'channels'), 5).map(([id, c], i) => `**${i + 1}.** <#${id}> — \`${fmt(c)}\``).join('\n') || '—';
    const ocsRaw = topN(sumMap(stats, 'ocs'), 5);
    const topOcs = ocsRaw.length ? ocsRaw.map(([n, c], i) => `**${i + 1}.** ${n} — \`${fmt(c)}\``).join('\n') : '_nenhum OC ainda_';
    const wordsRaw = topN(sumMap(stats, 'words'), 10);
    const topWords = wordsRaw.length ? wordsRaw.map(([w]) => `\`${w}\``).join(' · ') : '_sem dados_';

    // Comparação com o ano anterior (só quando um ano específico foi pedido)
    let compara = '';
    if (year) {
        const prev = await fetchRange(guildId, `${year - 1}-01-01`, `${year - 1}-12-31`);
        const prevTotal = totalOf(prev);
        if (prevTotal > 0) {
            const diff = ((total - prevTotal) / prevTotal) * 100;
            const seta = diff >= 0 ? '📈' : '📉';
            compara = `${seta} **${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%** vs ${year - 1} (\`${fmt(prevTotal)}\`)`;
        }
    }

    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(`✨ Wrapped ${periodo} — ${message.guild!.name}`)
        .setDescription(`A retrospectiva do servidor ${year ? `em **${year}**` : 'em toda a história'}.`)
        .setThumbnail(message.guild!.iconURL())
        .addFields(
            { name: '📨 Total de mensagens', value: `\`${fmt(total)}\``, inline: true },
            { name: '📊 Média/dia ativo', value: `\`${fmt(media)}\``, inline: true },
            { name: '🔥 Dia mais movimentado', value: `${formatDateBR(peak.date)} (\`${fmt(peak.total)}\`)`, inline: true },
            { name: '⏰ Horário de pico', value: `**${favHour}h** (UTC)`, inline: true },
            { name: '📅 Dia mais ativo', value: `**${WEEKDAYS_FULL[favWd]}**`, inline: true },
            ...(compara ? [{ name: '📈 Comparação', value: compara, inline: true }] : []),
            { name: '👥 Top 5 Usuários', value: topUsers, inline: false },
            { name: '💬 Top 5 Canais', value: topChannels, inline: false },
            { name: '🎭 Top 5 OCs', value: topOcs, inline: false },
            { name: '📝 Palavras do período', value: truncarCampo(topWords), inline: false },
        )
        .setFooter({ text: 'RPTool | Wrapped • horários em UTC' });

    return message.reply({ embeds: [embed] });
}
