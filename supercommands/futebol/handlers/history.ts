import { Message, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { TournamentModel, TeamModel } from '../../../tools/models/FutebolSchema';
import { extractArgs } from '../../../tools/utils/textUtils';

export async function handleHistory(message: Message, args: string[]) {
    const cleanArgs = extractArgs(message.content, 'history');
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol history "Nome do Torneio"`');

    const tourneyName = cleanArgs[0];

    const finishedTournaments = await TournamentModel.find({
        guildId: message.guild!.id,
        name:    new RegExp(`^${escapeRegex(tourneyName)}$`, 'i'),
        status:  'FINISHED',
    });

    if (finishedTournaments.length === 0) {
        return message.reply(`❌ Nenhuma edição finalizada de **${tourneyName}** encontrada.`);
    }

    // Mapeia campeões — agora usa teamName CACHEADO na standings (fix bug #4)
    const championsCount: Record<string, { count: number; emoji: string }> = {};

    // Para cada edição finalizada, o campeão é quem tem mais pontos na tabela final
    for (const tournament of finishedTournaments) {
        if (tournament.standings.length === 0) continue;

        const winner = [...tournament.standings].sort((a, b) => {
            const ptsDiff = b.points - a.points;
            if (ptsDiff !== 0) return ptsDiff;
            return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
        })[0];

        if (!winner) continue;

        // Tenta primeiro o nome cacheado (teamName), depois busca no banco
        // Isso garante que times deletados ainda aparecem no histórico
        let name  = winner.teamName;
        let emoji = winner.teamEmoji ?? '⚽';

        if (!name || name === 'Time Desconhecido') {
            const teamDoc = await TeamModel.findById(winner.teamId).catch(() => null);
            name  = teamDoc?.name  ?? `Time (${winner.teamId.slice(-6)})`;
            emoji = teamDoc?.emoji ?? '⚽';
        }

        if (!championsCount[name]) championsCount[name] = { count: 0, emoji };
        championsCount[name].count++;
    }

    if (Object.keys(championsCount).length === 0) {
        return message.reply('❌ Não foi possível determinar campeões nas edições finalizadas.');
    }

    const sorted   = Object.entries(championsCount).sort((a, b) => b[1].count - a[1].count);
    const labels   = sorted.map(([name]) => name.length > 20 ? name.slice(0, 18) + '…' : name);
    const values   = sorted.map(([, d]) => d.count);
    const emojis   = sorted.map(([, d]) => d.emoji);

    const COLORS = ['#00a8ff','#e84118','#fbc531','#4cd137','#9c88ff','#fd9644','#26de81','#fc5c65','#45aaf2','#a55eea'];
    const bgColors = labels.map((_, i) => COLORS[i % COLORS.length]);

    const chartCanvas = new ChartJSNodeCanvas({ width: 900, height: 550, backgroundColour: '#2b2d31' });

    const configuration: any = {
        type: 'bar',
        data: {
            labels: labels.map((l, i) => `${emojis[i]} ${l}`),
            datasets: [{
                label:           'Títulos',
                data:            values,
                backgroundColor: bgColors,
                borderColor:     bgColors,
                borderWidth:     2,
                borderRadius:    6,
            }],
        },
        options: {
            plugins: {
                legend: { labels: { color: '#fff', font: { size: 14 } } },
                title:  { display: true, text: `🏆 Galeria de Campeões — ${tourneyName}`, color: '#fff', font: { size: 22, weight: 'bold' }, padding: { bottom: 20 } },
            },
            scales: {
                y: { ticks: { color: '#ccc', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.08)' } },
                x: { ticks: { color: '#fff', font: { size: 13 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
            animation: false,
        },
    };

    const imageBuffer = await chartCanvas.renderToBuffer(configuration);
    const attachment  = new AttachmentBuilder(imageBuffer, { name: 'historico_campeoes.png' });

    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle(`🏆 Histórico: ${tourneyName}`)
        .setDescription(
            sorted.map(([name, d], i) =>
                `${i === 0 ? '👑' : `\`${i + 1}º\``} ${d.emoji} **${name}** — ${d.count} título${d.count !== 1 ? 's' : ''}`,
            ).join('\n'),
        )
        .setImage('attachment://historico_campeoes.png')
        .setFooter({ text: `${finishedTournaments.length} edição(ões) finalizada(s)` });

    return message.reply({ embeds: [embed], files: [attachment] });
}

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }