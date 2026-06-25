// RPTool/supercommands/status/handlers/historico.ts
// ─── rp!status historico [@user] ───────────────────────────────────────────────
// A "curva de vida": atividade mês a mês desde o primeiro dado, em gráfico de linha.
import { Message, EmbedBuilder } from 'discord.js';
import { fetchRange, monthlySeries, peakDay, totalOf, lineChart, formatYM, formatDateBR, fmt } from './aggregate';

export async function handleHistorico(message: Message, args: string[]): Promise<any> {
    const guildId = message.guild!.id;

    const targetUser = message.mentions?.users?.first() ?? null;
    let uid: string | undefined = targetUser?.id;
    if (!uid && args[1] && /^\d{17,20}$/.test(args[1])) uid = args[1];

    const stats = await fetchRange(guildId);
    if (!stats.length) return message.reply('📉 Ainda não tenho histórico. (Rode `rp!status docpast`.)');

    const series = monthlySeries(stats, uid);
    if (series.length === 0) return message.reply(uid ? '📉 Esse usuário não tem atividade registrada.' : '📉 Sem atividade registrada.');

    const chart = await lineChart(series.map(p => formatYM(p.ym)), series.map(p => p.total), 'historico.png');

    const total = totalOf(stats, uid);
    const peak = peakDay(stats, uid);
    const media = Math.round(total / series.length);
    const alvo = uid ? ` — <@${uid}>` : '';

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📈 Linha do Tempo${alvo}`)
        .setDescription(`Atividade mês a mês ${uid ? 'dessa pessoa' : `de **${message.guild!.name}**`}, desde **${formatYM(series[0].ym)}**.`)
        .setImage('attachment://historico.png')
        .addFields(
            { name: 'Total', value: `\`${fmt(total)}\` msgs`, inline: true },
            { name: 'Média/mês', value: `\`${fmt(media)}\``, inline: true },
            { name: '🏆 Dia recorde', value: `${formatDateBR(peak.date)} (\`${fmt(peak.total)}\`)`, inline: true },
        )
        .setFooter({ text: `RPTool | Status • ${series.length} meses de histórico` });

    return message.reply({ embeds: [embed], files: [chart] });
}
