import { Message, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { MatchReportModel } from '../../../tools/models/FutebolReportSchema';
import axios from 'axios';

// ─── rp!futebol export <ID> ───────────────────────────────────────────────────
export async function handleExport(message: Message, args: string[]) {
    const reportId = args[1]; // rp!futebol export <ID>

    if (!reportId) {
        return message.reply(
            '⚠️ **Uso:** `rp!futebol export <ID>`\n' +
            '*O ID está no rodapé da análise original.*',
        );
    }

    try {
        const report = await MatchReportModel.findById(reportId);

        if (!report) {
            return message.reply(
                '❌ Relatório não encontrado. Verifique o ID ou a análise pode ter **expirado** (limite de 48h).',
            );
        }

        const data   = JSON.stringify(report.toJSON(), null, 2);
        const buffer = Buffer.from(data, 'utf-8');

        const safeName = `${report.homeTeamName}_vs_${report.awayTeamName}`
            .replace(/[^a-zA-Z0-9_\-]/g, '_')
            .slice(0, 60);

        const attachment = new AttachmentBuilder(buffer, { name: `match_${safeName}.json` });

        return message.reply({
            content:
                `📦 **Relatório Exportado!**\n` +
                `Guarda este arquivo. Para rever a qualquer momento, usa \`rp!futebol import\` anexando-o.`,
            files: [attachment],
        });

    } catch (e) {
        console.error('[Export] Erro ao exportar relatório:', e);
        return message.reply('❌ ID inválido ou erro ao acessar o banco de dados.');
    }
}

// ─── rp!futebol import (+ anexo .json) ───────────────────────────────────────
export async function handleImport(message: Message) {
    const attachment = message.attachments.first();

    if (!attachment || !attachment.name?.endsWith('.json')) {
        return message.reply('⚠️ Anexe o arquivo `.json` que você exportou com `rp!futebol export`.');
    }

    try {
        const response = await axios.get<any>(attachment.url, { timeout: 10_000 });
        const report   = response.data;

        // Validação mínima do formato
        if (!report.homeTeamName || !report.awayTeamName || !report.stats) {
            return message.reply('❌ O arquivo não parece ser um relatório de partida válido do RPTool.');
        }

        const hs = report.stats;

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`📜 Registro Histórico: ${report.homeTeamName} × ${report.awayTeamName}`)
            .setDescription(
                `## ${report.homeTeamName}  ${report.homeScore}  ×  ${report.awayScore}  ${report.awayTeamName}`,
            )
            .addFields(
                {
                    name:  '📊 Estatísticas Finais',
                    value: [
                        `**Posse:** ${hs.possessionHome ?? '?'}% ↔ ${hs.possessionAway ?? '?'}%`,
                        `**Chutes (no alvo):** ${hs.shotsHome ?? '?'} (${hs.shotsOnTargetHome ?? '?'}) ↔ ${hs.shotsAway ?? '?'} (${hs.shotsOnTargetAway ?? '?'})`,
                        `**Faltas:** ${hs.foulsHome ?? '?'} ↔ ${hs.foulsAway ?? '?'}`,
                        `**Cartões 🟨/🟥:** ${hs.yellowCardsHome ?? 0}/${hs.redCardsHome ?? 0} ↔ ${hs.yellowCardsAway ?? 0}/${hs.redCardsAway ?? 0}`,
                        `**Escanteios:** ${hs.cornersHome ?? '?'} ↔ ${hs.cornersAway ?? '?'}`,
                        `**Precisão de Passes:** ${hs.passAccuracyHome ?? '?'}% ↔ ${hs.passAccuracyAway ?? '?'}%`,
                    ].join('\n'),
                    inline: false,
                },
                {
                    name:   '🛡️ Táticas',
                    value:  `**${report.homeTeamName}:** ${report.homeFormation ?? '?'} (${report.homeTactic ?? '?'})\n**${report.awayTeamName}:** ${report.awayFormation ?? '?'} (${report.awayTactic ?? '?'})`,
                    inline: true,
                },
            )
            .setFooter({ text: 'Registro importado de arquivo externo • Os botões de análise não estão disponíveis para históricos importados.' });

        // Notas individuais (se existirem no arquivo)
        if (Array.isArray(report.playerRatings) && report.playerRatings.length > 0) {
            const homeRatings = report.playerRatings
                .filter((r: any) => r.team === report.homeTeamName)
                .sort((a: any, b: any) => b.rating - a.rating)
                .slice(0, 5)
                .map((r: any) => `▸ **${r.playerName}** — ${r.rating}`)
                .join('\n');

            const awayRatings = report.playerRatings
                .filter((r: any) => r.team === report.awayTeamName)
                .sort((a: any, b: any) => b.rating - a.rating)
                .slice(0, 5)
                .map((r: any) => `▸ **${r.playerName}** — ${r.rating}`)
                .join('\n');

            if (homeRatings) embed.addFields({ name: `⭐ Top ${report.homeTeamName}`, value: homeRatings, inline: true });
            if (awayRatings) embed.addFields({ name: `⭐ Top ${report.awayTeamName}`, value: awayRatings, inline: true });
        }

        return message.reply({ embeds: [embed] });

    } catch (e) {
        console.error('[Import] Erro ao importar relatório:', e);
        return message.reply('❌ Não foi possível ler o arquivo. Certifique-se de que é um JSON válido exportado pelo RPTool.');
    }
}