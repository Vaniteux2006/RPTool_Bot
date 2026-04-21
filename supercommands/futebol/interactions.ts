import {
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    ButtonInteraction,
    StringSelectMenuInteraction,
} from 'discord.js';
import { MatchReportModel } from '../../tools/models/FutebolReportSchema';
import { TeamModel } from '../../tools/models/FutebolSchema';

// ─── Ponto de entrada — registre no interaction_checkout.ts:
//   if (interaction.customId.startsWith('fb_')) await handleFutebolInteraction(interaction);
export async function handleFutebolInteraction(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
) {
    const id = interaction.customId;

    // ── Dropdown de seleção de partida de rodada ──────────────────────────────
    if (interaction.isStringSelectMenu() && id.startsWith('fb_round_select')) {
        const reportId = interaction.values[0];
        const report   = await MatchReportModel.findById(reportId).catch(() => null);

        if (!report) {
            return interaction.reply({ content: '❌ Súmula expirada (limite de 48h).', ephemeral: true });
        }

        const expirationTs = Math.floor(report.createdAt.getTime() / 1000) + 48 * 3600;
        return interaction.reply({
            embeds:     [buildSummaryEmbed(report, expirationTs)],
            components: [buildDetailButtons(reportId)],
            ephemeral:  true,
        });
    }

    if (!interaction.isButton()) return;

    // ── Botão "Aplicar Tática Sugerida" ──────────────────────────────────────
    // customId: fb_apply_tactic_<teamId>_<formation>_<tactic>
    if (id.startsWith('fb_apply_tactic_')) {
        const parts     = id.split('_');
        const teamId    = parts[3];
        const formation = parts[4];
        const tactic    = parts[5];

        const team = await TeamModel.findById(teamId).catch(() => null);
        if (!team) return interaction.reply({ content: '❌ Time não encontrado.', ephemeral: true });
        if (team.adminId !== interaction.user.id) {
            return interaction.reply({ content: '❌ Apenas o dono do time pode aplicar esta tática.', ephemeral: true });
        }

        team.defaultFormation = formation;
        team.defaultTactic    = tactic;
        await team.save();

        return interaction.reply({
            content:   `✅ Tática aplicada em **${team.name}**: \`${formation}\` — **${tactic}**`,
            ephemeral: true,
        });
    }

    // ── Botão de fechar/ignorar ────────────────────────────────────────────────
    if (id === 'fb_dismiss') {
        return interaction.update({ components: [] });
    }

    // ── Botões de detalhes da partida: fb_tatic_<id>, fb_rate_<id>, fb_log_<id>
    const parts    = id.split('_');   // ['fb', 'tatic'/'rate'/'log', '<reportId>']
    const action   = parts[1];
    const reportId = parts[2];

    const report = await MatchReportModel.findById(reportId).catch(() => null);
    if (!report) {
        return interaction.reply({
            content:   '❌ **Súmula destruída.** As análises expiram após 48h para poupar espaço.',
            ephemeral: true,
        });
    }

    // ── 📋 Estatísticas Táticas ───────────────────────────────────────────────
    if (action === 'tatic') {
        const s = report.stats;

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`📋 Análise Tática: ${report.homeTeamName} × ${report.awayTeamName}`)
            .addFields(
                {
                    name:   `🏠 ${report.homeTeamName}`,
                    value:  `**Formação:** \`${report.homeFormation}\`\n**Estilo:** ${report.homeTactic}`,
                    inline: true,
                },
                {
                    name:   `🚌 ${report.awayTeamName}`,
                    value:  `**Formação:** \`${report.awayFormation}\`\n**Estilo:** ${report.awayTactic}`,
                    inline: true,
                },
                { name: '\u200B', value: '\u200B', inline: false },
                {
                    name:   '⚔️ Vantagem Tática',
                    value:  getTacticalEdgeText(report.homeTactic, report.awayTactic),
                    inline: false,
                },
                {
                    name:   '📊 Números Avançados',
                    value: [
                        `**Posse:** ${s.possessionHome}% ↔ ${s.possessionAway}%`,
                        `**Precisão de passes:** ${s.passAccuracyHome}% ↔ ${s.passAccuracyAway}%`,
                        `**Chutes totais:** ${s.shotsHome} ↔ ${s.shotsAway}`,
                        `**Chutes no alvo:** ${s.shotsOnTargetHome} ↔ ${s.shotsOnTargetAway}`,
                        `**Escanteios:** ${s.cornersHome} ↔ ${s.cornersAway}`,
                        `**Faltas:** ${s.foulsHome} ↔ ${s.foulsAway}`,
                        `**Cartões 🟨/🟥:** ${s.yellowCardsHome}/${s.redCardsHome} ↔ ${s.yellowCardsAway}/${s.redCardsAway}`,
                    ].join('\n'),
                    inline: false,
                },
            )
            .setFooter({ text: 'Motor de Simulação Tática — RPTool' });

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── ⭐ Notas Individuais ───────────────────────────────────────────────────
    if (action === 'rate') {
        const homeRatings = report.playerRatings
            .filter(r => r.team === report.homeTeamName)
            .sort((a, b) => b.rating - a.rating);

        const awayRatings = report.playerRatings
            .filter(r => r.team === report.awayTeamName)
            .sort((a, b) => b.rating - a.rating);

        const fmt = (r: any) => {
            const star  = r.rating >= 9 ? '🌟' : r.rating >= 7 ? '🟢' : r.rating < 5 ? '🔴' : '🟡';
            const subMark = r.isSub ? ' 🔄' : '';
            return `${star} **${r.playerName}**${subMark} — \`${r.rating}\``;
        };

        const homeStr = homeRatings.length > 0 ? homeRatings.map(fmt).join('\n') : '*Sem dados.*';
        const awayStr = awayRatings.length > 0 ? awayRatings.map(fmt).join('\n') : '*Sem dados.*';

        const embed = new EmbedBuilder()
            .setColor('DarkGreen')
            .setTitle(`⭐ Notas da Partida: ${report.homeTeamName} × ${report.awayTeamName}`)
            .setDescription(
                `**Resultado:** **${report.homeScore}** × **${report.awayScore}**\n\n` +
                `🌟 ≥ 9.0  🟢 ≥ 7.0  🟡 5.0–6.9  🔴 < 5.0  🔄 = substituto`,
            )
            .addFields(
                {
                    name:   `🏠 ${report.homeTeamName}` + (report.topPerformerHome ? ` — 🌟 ${report.topPerformerHome}` : ''),
                    value:  homeStr,
                    inline: true,
                },
                {
                    name:   `🚌 ${report.awayTeamName}` + (report.topPerformerAway ? ` — 🌟 ${report.topPerformerAway}` : ''),
                    value:  awayStr,
                    inline: true,
                },
            );

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── 📰 Narração Completa ──────────────────────────────────────────────────
    if (action === 'log') {
        const log = report.eventsLog ?? [];

        if (log.length === 0) {
            return interaction.reply({ content: '📭 Narração não disponível.', ephemeral: true });
        }

        // Divide em páginas de 25 linhas (embeds têm limite de 4096 chars)
        const CHUNK_SIZE = 25;
        const pages = chunkArray(log, CHUNK_SIZE);

        const embed = new EmbedBuilder()
            .setColor('DarkButNotBlack')
            .setTitle(`📰 Narração: ${report.homeTeamName} × ${report.awayTeamName}`)
            .setDescription(pages[0].join('\n'))
            .setFooter({
                text: pages.length > 1
                    ? `Parte 1/${pages.length} — Use rp!futebol export ${reportId} para o log completo`
                    : 'Narração completa',
            });

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildSummaryEmbed(report: any, expirationTs: number): EmbedBuilder {
    const s = report.stats;
    return new EmbedBuilder()
        .setColor('DarkButNotBlack')
        .setTitle('🏁 Visão da Partida')
        .setDescription(`## ${report.homeTeamName}  **${report.homeScore}**  ×  **${report.awayScore}**  ${report.awayTeamName}`)
        .addFields(
            { name: 'Posse de Bola',     value: `**${s.possessionHome}%** ↔ **${s.possessionAway}%**`,                                                                inline: false },
            { name: 'Chutes (no alvo)',  value: `**${s.shotsHome}** (${s.shotsOnTargetHome}) ↔ **${s.shotsAway}** (${s.shotsOnTargetAway})`,                          inline: false },
            { name: 'Faltas',            value: `**${s.foulsHome}** ↔ **${s.foulsAway}**`,                                                                            inline: false },
            { name: 'Precisão de Passes',value: `**${s.passAccuracyHome}%** ↔ **${s.passAccuracyAway}%**`,                                                            inline: false },
        )
        .setFooter({ text: `⚠️ Análise expira <t:${expirationTs}:R> • rp!futebol export ${report._id}` });
}

function buildDetailButtons(reportId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`fb_tatic_${reportId}`).setLabel('Estatísticas Táticas').setEmoji('📋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`fb_rate_${reportId}`).setLabel('Notas Individuais').setEmoji('⭐').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`fb_log_${reportId}`).setLabel('Narração Completa').setEmoji('📰').setStyle(ButtonStyle.Secondary),
    );
}

function getTacticalEdgeText(home: string, away: string): string {
    const edges: [string, string, string, string][] = [
        ['POSSE',         'RETRANCA',      '🏠 Vantagem',  'Posse de bola encontra espaços na retranca.'],
        ['PRESSAO',       'POSSE',         '🏠 Vantagem',  'Pressão alta sufoca o toque de bola.'],
        ['RETRANCA',      'CONTRA_ATAQUE', '🏠 Vantagem',  'Retranca fecha os espaços do contra-ataque.'],
        ['CONTRA_ATAQUE', 'PRESSAO',       '🏠 Vantagem',  'Contra-ataque pune a linha alta da pressão.'],
        ['POSSE',         'PRESSAO',       '🚌 Vantagem',  'Pressão alta sufoca o time de posse.'],
        ['RETRANCA',      'POSSE',         '🚌 Vantagem',  'Paciência do visitante supera a retranca.'],
    ];

    for (const [h, a, side, desc] of edges) {
        if (home === h && away === a) return `${side} — ${desc}`;
        if (away === h && home === a) return `${side === '🏠 Vantagem' ? '🚌 Vantagem' : '🏠 Vantagem'} — ${desc}`;
    }
    return '⚖️ Confronto equilibrado. O resultado depende da qualidade individual.';
}

function chunkArray<T>(arr: T[], size: number): T[][] {
    const r: T[][] = [];
    for (let i = 0; i < arr.length; i += size) r.push(arr.slice(i, i + size));
    return r;
}