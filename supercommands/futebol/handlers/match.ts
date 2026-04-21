import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { TeamModel } from '../../../tools/models/FutebolSchema';
import { simulateTacticalMatch, TacticStyle, buildExpirationFooter, IrlOptions } from '../engines/matchEngine';
import { generateTeamViaAI } from '../engines/aiDirector';
import { extractArgs } from '../../../tools/utils/textUtils';

// ─── rp!futebol match "Time A" "Time B" [-n] [-r] [-irl [segundos]] ───────────
// Flags:
//   -n        → campo neutro (sem bônus de mandante)
//   -r        → resultado direto (sem narração inline)
//   -irl [s]  → modo ao vivo, embed atualizado em tempo real
//               o admin pode configurar o tempo entre cada minuto (10–60s, padrão 15s)
export default async function handleMatch(message: Message, args: string[]) {
    const cleanArgs = extractArgs(message.content, 'match');
    const flags     = args.filter(a => a.startsWith('-'));

    const isNeutral = flags.includes('-n');
    const isQuick   = flags.includes('-r');
    const irlIndex  = flags.indexOf('-irl');
    const isIRL     = irlIndex !== -1;

    // Tempo por minuto em modo IRL (10–60s, padrão 15s)
    let secondsPerMinute = 15;
    if (isIRL) {
        const rawSec = parseInt(flags[irlIndex + 1] ?? '', 10);
        if (!isNaN(rawSec)) secondsPerMinute = Math.min(60, Math.max(10, rawSec));
    }

    const teamArgs = cleanArgs.filter(a => !a.startsWith('-') && isNaN(Number(a)));

    if (teamArgs.length < 2) {
        return message.reply(
            '⚠️ **Uso:** `rp!futebol match "Time A" "Time B" [-n] [-r] [-irl [segundos]]`\n' +
            '`-n` campo neutro | `-r` resultado direto | `-irl [10-60]` ao vivo (padrão 15s/minuto)',
        );
    }

    const homeName = teamArgs[0];
    const awayName = teamArgs[1];

    const waitMsg = await message.reply('⏳ Preparando o confronto...');

    // ─── Busca ou gera os times ───────────────────────────────────────────────
    let homeTeam = await TeamModel.findOne({ name: new RegExp(`^${escapeRegex(homeName)}$`, 'i'), guildOriginId: message.guild!.id }) as any;
    if (!homeTeam) {
        await waitMsg.edit(`🤖 **${homeName}** não encontrado — gerando elenco via IA...`);
        const aiPlayers = await generateTeamViaAI(message.guild!.id, homeName, 80);
        if (!aiPlayers) return waitMsg.edit('❌ Falha ao gerar o time mandante. Crie com `rp!futebol create`.');
        homeTeam = { name: homeName, players: aiPlayers, logo: '', emoji: '⚽', defaultFormation: '4-4-2', defaultTactic: 'BALANCEADO' };
    }

    let awayTeam = await TeamModel.findOne({ name: new RegExp(`^${escapeRegex(awayName)}$`, 'i'), guildOriginId: message.guild!.id }) as any;
    if (!awayTeam) {
        await waitMsg.edit(`🤖 **${awayName}** não encontrado — gerando elenco via IA...`);
        const aiPlayers = await generateTeamViaAI(message.guild!.id, awayName, 80);
        if (!aiPlayers) return waitMsg.edit('❌ Falha ao gerar o time visitante. Crie com `rp!futebol create`.');
        awayTeam = { name: awayName, players: aiPlayers, logo: '', emoji: '⚽', defaultFormation: '4-4-2', defaultTactic: 'BALANCEADO' };
    }

    await waitMsg.edit(isIRL
        ? `📡 Modo ao vivo ativado! **1 minuto de jogo = ${secondsPerMinute}s**. O embed será atualizado em tempo real.`
        : '⚽ A bola está rolando...',
    );

    const homeTactic = (homeTeam.defaultTactic ?? 'BALANCEADO') as TacticStyle;
    const awayTactic = (awayTeam.defaultTactic  ?? 'BALANCEADO') as TacticStyle;

    // Modo IRL: passa as opções para o engine
    const irlOptions: IrlOptions | undefined = isIRL ? {
        message,
        secondsPerMinute,
        homeAdminId: homeTeam.adminId ?? message.author.id,
        awayAdminId: awayTeam.adminId ?? message.author.id,
    } : undefined;

    // ─── Simulação ────────────────────────────────────────────────────────────
    const result = await simulateTacticalMatch(
        message.guild!.id,
        homeTeam, awayTeam,
        homeTactic, awayTactic,
        undefined,
        irlOptions,
    );

    // ─── Embed de resultado (estilo Google) ───────────────────────────────────
    const resultColor = result.homeScore > result.awayScore ? 'Green'
        : result.homeScore < result.awayScore ? 'Red' : 'Yellow';

    const neutralTag = isNeutral ? ' *(campo neutro)*' : '';
    const goalLines  = result.eventsLog.filter(l => l.includes('⚽'));
    const cardLines  = result.eventsLog.filter(l => l.includes('🟨') || l.includes('🟥'));
    const subLines   = result.eventsLog.filter(l => l.includes('🔄'));
    const eventsSummary = [...goalLines, ...cardLines, ...subLines].join('\n') || '*Partida sem incidentes.*';

    const homeEmoji = homeTeam.emoji ?? '⚽';
    const awayEmoji = awayTeam.emoji ?? '⚽';

    const embed = new EmbedBuilder()
        .setColor(resultColor)
        .setTitle('🏁 Fim de Jogo!')
        .setDescription(
            `## ${homeEmoji} ${homeTeam.name}${neutralTag}  **${result.homeScore}**  ×  **${result.awayScore}**  ${awayTeam.name} ${awayEmoji}\n\n` +
            eventsSummary,
        )
        .addFields(
            { name: '\u200B', value: '**📊 ESTATÍSTICAS**', inline: false },
            { name: 'Posse de Bola',     value: `**${result.finalPossessionHome}%** ↔ **${result.finalPossessionAway}%**`,                     inline: true  },
            { name: 'Chutes (no alvo)',  value: `**${result.stats.shotsHome}** (${result.stats.shotsOnTargetHome}) ↔ **${result.stats.shotsAway}** (${result.stats.shotsOnTargetAway})`, inline: true  },
            { name: 'Faltas',            value: `**${result.stats.foulsHome}** ↔ **${result.stats.foulsAway}**`,                               inline: true  },
            { name: 'Precisão de Passes',value: `**${result.stats.passAccuracyHome}%** ↔ **${result.stats.passAccuracyAway}%**`,               inline: true  },
            { name: 'Escanteios',        value: `**${result.stats.cornersHome}** ↔ **${result.stats.cornersAway}**`,                           inline: true  },
            { name: 'Cartões 🟨/🟥',     value: `**${result.stats.yellowCardsHome}/${result.stats.redCardsHome}** ↔ **${result.stats.yellowCardsAway}/${result.stats.redCardsAway}**`, inline: true },
        )
        .setFooter({ text: buildExpirationFooter(result.reportId) });

    if (result.topPerformerHome || result.topPerformerAway) {
        embed.addFields({
            name:  '⭐ Destaques',
            value: `${homeEmoji} **${homeTeam.name}:** ${result.topPerformerHome || 'N/A'} • ${awayEmoji} **${awayTeam.name}:** ${result.topPerformerAway || 'N/A'}`,
            inline: false,
        });
    }

    // ─── Botões de Revelação Progressiva ─────────────────────────────────────
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`fb_tatic_${result.reportId}`).setLabel('Estatísticas Táticas').setEmoji('📋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`fb_rate_${result.reportId}`).setLabel('Notas Individuais').setEmoji('⭐').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`fb_log_${result.reportId}`).setLabel('Narração Completa').setEmoji('📰').setStyle(ButtonStyle.Secondary),
    );

    // No modo rápido, embed simplificado
    if (isQuick) {
        const q = new EmbedBuilder()
            .setColor(resultColor)
            .setTitle('⚡ Resultado Direto')
            .setDescription(`## ${homeEmoji} ${homeTeam.name}  **${result.homeScore}**  ×  **${result.awayScore}**  ${awayTeam.name} ${awayEmoji}\n\n📊 Posse: **${result.finalPossessionHome}%** ↔ **${result.finalPossessionAway}%** | Chutes: **${result.stats.shotsHome}** ↔ **${result.stats.shotsAway}**`)
            .setFooter({ text: buildExpirationFooter(result.reportId) });
        await waitMsg.delete().catch(() => null);
        return message.reply({ embeds: [q], components: [row] });
    }

    // No modo IRL, o embed ao vivo já está no canal — só limpamos a mensagem de espera
    if (isIRL) {
        await waitMsg.delete().catch(() => null);
        return; // embed final já foi editado pelo engine
    }

    await waitMsg.delete().catch(() => null);
    return message.reply({ embeds: [embed], components: [row] });
}

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }