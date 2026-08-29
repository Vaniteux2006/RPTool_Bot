// RPTool/supercommands/status/handlers/heatmap.ts
// ─── rp!status heatmap [@user] ─────────────────────────────────────────────────
// Mapa de calor dia-da-semana × hora (UTC) em blocos Unicode. Mostra quando o
// servidor (ou um usuário específico) vive.
import { Message, EmbedBuilder } from 'discord.js';
import { fetchRange, heatMatrix, totalOf, WEEKDAYS, fmt } from './aggregate';

const BLOCKS = ['·', '░', '▒', '▓', '█'];

function block(v: number, max: number): string {
    if (v <= 0) return ' ';
    return BLOCKS[Math.min(BLOCKS.length - 1, Math.floor((v / max) * BLOCKS.length))];
}

export async function handleHeatmap(message: Message, args: string[]): Promise<any> {
    const guildId = message.guild!.id;

    const targetUser = message.mentions?.users?.first() ?? null;
    let uid: string | undefined = targetUser?.id;
    if (!uid && args[1] && /^\d{17,20}$/.test(args[1])) uid = args[1];

    const stats = await fetchRange(guildId);
    if (!stats.length) return message.reply('📉 Ainda não tenho dados suficientes. (Rode `rp!status docpast` para puxar o histórico.)');

    const matrix = heatMatrix(stats, uid);
    let max = 0;
    for (const row of matrix) for (const c of row) if (c > max) max = c;

    if (max === 0) {
        return message.reply(uid ? '📉 Esse usuário não tem atividade registrada.' : '📉 Sem atividade registrada.');
    }

    // Grade
    const ruler = '    ' + '0h'.padEnd(6) + '6h'.padEnd(6) + '12h'.padEnd(6) + '18h'.padEnd(6);
    const rows = matrix.map((row, d) => WEEKDAYS[d].padEnd(4) + row.map(v => block(v, max)).join(''));
    const grid = '```\n' + ruler + '\n' + rows.join('\n') + '\n```';

    // Pico
    let bd = 0, bh = 0;
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (matrix[d][h] > matrix[bd][bh]) { bd = d; bh = h; }

    const alvo = uid ? ` — <@${uid}>` : '';
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🗺️ Heatmap de Atividade${alvo}`)
        .setDescription(
            `Quando ${uid ? 'essa pessoa' : 'o servidor'} mais fala (todo o histórico, fuso **UTC**).\n` +
            grid +
            `\nIntensidade: \`${BLOCKS.join(' ')}\` — de menos a mais ativo.`,
        )
        .addFields(
            { name: 'Total de mensagens', value: `\`${fmt(totalOf(stats, uid))}\``, inline: true },
            { name: '🔥 Pico', value: `**${WEEKDAYS[bd]}** às **${bh}h** (\`${fmt(matrix[bd][bh])}\`)`, inline: true },
        )
        .setFooter({ text: 'RPTool | Status • horários em UTC' });

    return message.reply({ embeds: [embed] });
}
