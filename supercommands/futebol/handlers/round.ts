import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from 'discord.js';
import {
    TournamentModel, TourneyMatchModel, TeamModel,
    IStanding, ITourneyMatch,
} from '../../../tools/models/FutebolSchema';
import { simulateTacticalMatch, TacticStyle } from '../engines/matchEngine';
import { extractArgs } from '../../../tools/utils/textUtils';

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function chunk<T>(arr: T[], n: number): T[][] { const r: T[][] = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n)); return r; }

// ─── rp!futebol round sim "Torneio" ──────────────────────────────────────────
export async function handleRoundSim(message: Message, args: string[]) {
    if (!message.guild!.members.cache.get(message.author.id)?.permissions.has('ManageGuild')) {
        return message.reply('❌ Apenas administradores podem simular rodadas.');
    }

    const cleanArgs = extractArgs(message.content, 'round sim');
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol round sim "Nome do Torneio"`');

    const tournament = await TournamentModel.findOne({ guildId: message.guild!.id, name: new RegExp(`^${escapeRegex(cleanArgs[0])}$`, 'i') });
    if (!tournament)                    return message.reply('❌ Torneio não encontrado.');
    if (tournament.status !== 'ACTIVE') return message.reply('❌ Torneio não está em andamento.');

    const pendingMatches = await TourneyMatchModel.find({ tournamentId: tournament.id, round: tournament.currentRound, status: 'PENDING' });
    if (pendingMatches.length === 0) {
        return message.reply(`✅ Todos os jogos da Rodada **${tournament.currentRound}** já foram finalizados.\nUse \`rp!futebol round next "${tournament.name}"\` para avançar.`);
    }

    const waitMsg = await message.reply(`⏳ Simulando **${pendingMatches.length}** partida(s) da Rodada **${tournament.currentRound}** em paralelo...`);

    const summaryLines:  string[] = [];
    const selectOptions: StringSelectMenuOptionBuilder[] = [];
    const standingsMap  = new Map<string, IStanding>(tournament.standings.map(s => [s.teamId, s]));

    await Promise.all(pendingMatches.map(async (match: ITourneyMatch) => {
        const homeTeam = await TeamModel.findById(match.homeTeamId);
        const awayTeam = await TeamModel.findById(match.awayTeamId);
        if (!homeTeam || !awayTeam) return;

        const result = await simulateTacticalMatch(
            message.guild!.id, homeTeam, awayTeam,
            (homeTeam.defaultTactic ?? 'BALANCEADO') as TacticStyle,
            (awayTeam.defaultTactic  ?? 'BALANCEADO') as TacticStyle,
            tournament.id,
        );

        match.homeScore = result.homeScore; match.awayScore = result.awayScore;
        match.status    = 'FINISHED';       match.reportId  = result.reportId;
        await match.save();

        updateStandings(standingsMap, match.homeTeamId, match.awayTeamId, result.homeScore, result.awayScore, homeTeam.name, awayTeam.name, homeTeam.emoji, awayTeam.emoji);

        const hE = homeTeam.emoji ?? '⚽'; const aE = awayTeam.emoji ?? '⚽';
        summaryLines.push(`${hE} **${homeTeam.name}** ${result.homeScore} × ${result.awayScore} **${awayTeam.name}** ${aE}`);
        selectOptions.push(new StringSelectMenuOptionBuilder().setLabel(`${homeTeam.name} vs ${awayTeam.name}`).setDescription(`${result.homeScore} - ${result.awayScore}`).setValue(result.reportId).setEmoji('⚽'));
    }));

    tournament.standings = Array.from(standingsMap.values()) as any;
    tournament.markModified('standings');
    await tournament.save();

    const summaryEmbed = new EmbedBuilder()
        .setColor('Green')
        .setTitle(`📌 Rodada ${tournament.currentRound} — ${tournament.name}`)
        .setDescription(summaryLines.join('\n\n') || '*Nenhum jogo.*')
        .setFooter({ text: 'Use o menu abaixo para ver detalhes de cada partida' });

    await waitMsg.delete().catch(() => null);

    if (selectOptions.length <= 1) return message.reply({ embeds: [summaryEmbed] });

    const menus = chunk(selectOptions, 25).slice(0, 5).map((batch, i) =>
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId(`fb_round_select_${i}`).setPlaceholder('🔍 Ver detalhes de uma partida...').addOptions(batch),
        ),
    );

    return message.reply({ embeds: [summaryEmbed], components: menus });
}

// ─── rp!futebol round next ────────────────────────────────────────────────────
export async function handleRoundNext(message: Message, args: string[]) {
    if (!message.guild!.members.cache.get(message.author.id)?.permissions.has('ManageGuild')) {
        return message.reply('❌ Apenas administradores podem avançar rodadas.');
    }

    const cleanArgs = extractArgs(message.content, 'round next');
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol round next "Nome do Torneio"`');

    const tournament = await TournamentModel.findOne({ guildId: message.guild!.id, name: new RegExp(`^${escapeRegex(cleanArgs[0])}$`, 'i') });
    if (!tournament || tournament.status !== 'ACTIVE') return message.reply('❌ Torneio não encontrado ou não está ativo.');

    const pending = await TourneyMatchModel.countDocuments({ tournamentId: tournament.id, round: tournament.currentRound, status: 'PENDING' });
    if (pending > 0) return message.reply(`⚠️ Ainda há **${pending}** jogo(s) pendente(s) na Rodada **${tournament.currentRound}**.`);

    if (tournament.currentRound >= tournament.totalRounds) {
        tournament.status = 'FINISHED'; await tournament.save();
        return message.reply(`🏆 **${tournament.name}** chegou ao fim! Use \`rp!futebol standings "${tournament.name}"\` para o resultado final.`);
    }

    tournament.currentRound++;
    await tournament.save();
    return message.reply(`➡️ Avançando para a **Rodada ${tournament.currentRound}** de **${tournament.name}**.`);
}

// ─── rp!futebol round view "Torneio" [nº] ────────────────────────────────────
// Sugestão 6: exibição diferente para league / groups / knockout
export async function handleRoundView(message: Message, args: string[]) {
    const cleanArgs = extractArgs(message.content, 'round view');
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol round view "Nome do Torneio" [nº da rodada]`');

    const tournament = await TournamentModel.findOne({ guildId: message.guild!.id, name: new RegExp(`^${escapeRegex(cleanArgs[0])}$`, 'i') });
    if (!tournament) return message.reply('❌ Torneio não encontrado.');

    const targetRound = cleanArgs[1] ? parseInt(cleanArgs[1], 10) : tournament.currentRound;

    const matches = await TourneyMatchModel.find({ tournamentId: tournament.id, round: targetRound });
    if (matches.length === 0) return message.reply(`📭 Nenhum jogo encontrado para a Rodada **${targetRound}**.`);

    const teamIds = [...new Set(matches.flatMap(m => [m.homeTeamId, m.awayTeamId]))];
    const teams   = await TeamModel.find({ _id: { $in: teamIds } });
    const teamMap = new Map(teams.map(t => [t.id, t]));

    const phase = tournament.phaseType;

    if (phase === 'groups') {
        return sendGroupsView(message, tournament, matches, teamMap, targetRound);
    } else if (phase === 'knockout') {
        return sendKnockoutView(message, tournament, matches, teamMap);
    } else {
        return sendLeagueView(message, tournament, matches, teamMap, targetRound);
    }
}

// ─── Vista de Pontos Corridos (league) ───────────────────────────────────────
async function sendLeagueView(message: Message, tournament: any, matches: ITourneyMatch[], teamMap: Map<string, any>, round: number) {
    const lines: string[] = [];

    for (const m of matches) {
        const home = teamMap.get(m.homeTeamId);
        const away = teamMap.get(m.awayTeamId);
        const hN = home?.name ?? '?';  const hE = home?.emoji ?? '⚽';
        const aN = away?.name ?? '?';  const aE = away?.emoji ?? '⚽';
        let icon = '⏳', score = 'vs';
        if (m.status === 'FINISHED')  { icon = '✅'; score = `**${m.homeScore}** × **${m.awayScore}**`; }
        if (m.status === 'POSTPONED') { icon = '🛑'; score = 'ADIADO'; }
        lines.push(`${icon} ${hE} **${hN}** ${score} **${aN}** ${aE}`);
    }

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`📅 Rodada ${round} — ${tournament.name}`)
        .setDescription(lines.join('\n\n'));

    return message.reply({ embeds: [embed] });
}

// ─── Vista de Fase de Grupos ──────────────────────────────────────────────────
async function sendGroupsView(message: Message, tournament: any, matches: ITourneyMatch[], teamMap: Map<string, any>, round: number) {
    // Agrupa por groupName
    const groupedMatches: Record<string, ITourneyMatch[]> = {};
    for (const m of matches) {
        const key = m.groupName ?? 'Grupo';
        if (!groupedMatches[key]) groupedMatches[key] = [];
        groupedMatches[key].push(m);
    }

    const fields: { name: string; value: string; inline: boolean }[] = [];

    for (const [groupName, gMatches] of Object.entries(groupedMatches)) {
        const lines: string[] = [];
        for (const m of gMatches) {
            const home = teamMap.get(m.homeTeamId);
            const away = teamMap.get(m.awayTeamId);
            const hN = home?.name ?? '?';  const hE = home?.emoji ?? '⚽';
            const aN = away?.name ?? '?';  const aE = away?.emoji ?? '⚽';
            let icon = '⏳', score = 'vs';
            if (m.status === 'FINISHED')  { icon = '✅'; score = `${m.homeScore}×${m.awayScore}`; }
            if (m.status === 'POSTPONED') { icon = '🛑'; score = 'ADIADO'; }
            lines.push(`${icon} ${hE} ${hN} ${score} ${aN} ${aE}`);
        }
        fields.push({ name: `**${groupName}**`, value: lines.join('\n'), inline: true });
    }

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`📅 Fase de Grupos — Rodada ${round} — ${tournament.name}`)
        .addFields(fields);

    return message.reply({ embeds: [embed] });
}

// ─── Vista de Mata-Mata (chaveamento estilo árvore) ───────────────────────────
async function sendKnockoutView(message: Message, tournament: any, matches: ITourneyMatch[], teamMap: Map<string, any>) {
    // Agrupa por bracketRound
    const roundOrder = ['Final', 'Terceiro Lugar', 'Semifinal', 'Quartas de Final', 'Oitavas de Final', 'Dezesseis-avos', 'Rodada 1'];
    const grouped: Record<string, ITourneyMatch[]> = {};

    for (const m of matches) {
        const key = m.bracketRound ?? 'Rodada';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
    }

    // Ordena as rodadas do torneio (final primeiro)
    const sortedRounds = Object.keys(grouped).sort((a, b) => {
        const ia = roundOrder.indexOf(a); const ib = roundOrder.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const fields: { name: string; value: string; inline: boolean }[] = [];

    for (const roundName of sortedRounds) {
        const rMatches = grouped[roundName].sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
        const pairs: string[] = [];

        // Exibe de 2 em 2 (lado a lado) se tiver mais de um jogo
        for (let i = 0; i < rMatches.length; i += 2) {
            const m1 = rMatches[i];
            const m2 = rMatches[i + 1];

            const fmt = (m: ITourneyMatch) => {
                const h = teamMap.get(m.homeTeamId); const a = teamMap.get(m.awayTeamId);
                const hN = h?.name ?? '??'; const aN = a?.name ?? '??';
                const hE = h?.emoji ?? '⚽'; const aE = a?.emoji ?? '⚽';
                if (m.status === 'FINISHED') return `${hE} **${hN} ${m.homeScore}×${m.awayScore} ${aN}** ${aE}`;
                if (m.status === 'POSTPONED') return `🛑 ${hE} ${hN} vs ${aN} ${aE} *(adiado)*`;
                return `⏳ ${hE} ${hN} vs ${aN} ${aE}`;
            };

            if (m2) {
                pairs.push(`${fmt(m1)}\n${fmt(m2)}`);
            } else {
                pairs.push(fmt(m1));
            }
        }

        fields.push({ name: `🏟️ **${roundName}**`, value: pairs.join('\n\n') || '*Sem jogos.*', inline: rMatches.length > 2 });
    }

    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle(`🏆 Chaveamento — ${tournament.name}`)
        .addFields(fields.length > 0 ? fields : [{ name: 'Sem dados', value: '*Chaveamento não disponível.*', inline: false }]);

    return message.reply({ embeds: [embed] });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function updateStandings(
    map: Map<string, IStanding>,
    homeId: string, awayId: string,
    hG: number, aG: number,
    homeName: string, awayName: string,
    homeEmoji: string, awayEmoji: string,
): void {
    let home = map.get(homeId);
    let away = map.get(awayId);

    if (!home) { home = { teamId: homeId, teamName: homeName, teamEmoji: homeEmoji, points: 0, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }; map.set(homeId, home); }
    if (!away) { away = { teamId: awayId, teamName: awayName, teamEmoji: awayEmoji, points: 0, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }; map.set(awayId, away); }

    // Garante que os nomes estão sempre atualizados
    home.teamName = homeName; home.teamEmoji = homeEmoji;
    away.teamName = awayName; away.teamEmoji = awayEmoji;

    home.games++; away.games++;
    home.goalsFor += hG; home.goalsAgainst += aG;
    away.goalsFor += aG; away.goalsAgainst += hG;

    if (hG > aG)      { home.wins++; home.points += 3; away.losses++; }
    else if (hG < aG) { away.wins++; away.points += 3; home.losses++; }
    else              { home.draws++; home.points++;    away.draws++;  away.points++; }
}