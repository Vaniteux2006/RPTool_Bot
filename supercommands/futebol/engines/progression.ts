// RPTool/supercommands/futebol/engines/progression.ts
// ─── Motor de Progressão de Torneios ─────────────────────────────────────────
// Responsável por TODA a máquina de fases de um torneio:
//   • gerar as partidas de cada tipo de fase (liga, grupos, mata-mata, suíço)
//   • avançar rodadas, resolver confrontos de mata-mata (agregado + pênaltis)
//   • transição entre fases (grupos → mata-mata, suíço → playoff, etc.)
//   • encerrar o torneio e registrar o campeão
import path from 'path';
import fs from 'fs';
import {
    TournamentModel,
    TourneyMatchModel,
    TeamModel,
    ITournament,
    ITourneyMatch,
    IStanding,
} from '../../../tools/models/FutebolSchema';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface PhaseConfig {
    name?:                string;
    type:                 'league' | 'groups' | 'knockout' | 'swiss';
    homeAndAway?:         boolean;
    groupsCount?:         number;
    teamsPerGroup?:       number;
    advancingPerGroup?:   number;
    bestThirdPlaces?:     number;
    advancingToPlayoffs?: number;
    advancingToPlayIn?:   number;
    directAdvancing?:     number;
    playoffSpots?:        number;
    gamesPerTeam?:        number;
    pointsHalved?:        boolean;
    teamsInvolved?:       number;
    neutralFinal?:        boolean;
}

export interface FormatConfig {
    name?:        string;
    flag?:        string;
    description?: string;
    minTeams:     number;
    maxTeams:     number;
    phases:       PhaseConfig[];
    relegation?:  number;
}

export interface PhaseStartResult {
    roundsGenerated: number;   // rodadas efetivamente criadas agora
    estimatedRounds: number;   // rodadas previstas para a fase inteira
    description:     string;   // resumo para o usuário
}

// ─── Formatos ─────────────────────────────────────────────────────────────────
export function loadFormats(): Record<string, FormatConfig> {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../data/formats.json'), 'utf-8'));
}

// Config resolvida do torneio: snapshot salvo na criação > formats.json > fallback liga simples
export function getFormatConfig(t: ITournament): FormatConfig {
    if (t.formatConfig?.phases?.length) return t.formatConfig as FormatConfig;
    const fromFile = loadFormats()[t.format];
    if (fromFile) return fromFile;
    return { minTeams: 2, maxTeams: 128, phases: [{ name: 'Pontos Corridos', type: 'league', homeAndAway: true }], relegation: 0 };
}

export function getPhases(t: ITournament): PhaseConfig[] {
    return getFormatConfig(t).phases;
}

export function getCurrentPhase(t: ITournament): PhaseConfig {
    const phases = getPhases(t);
    return phases[t.currentPhase ?? 0] ?? phases[phases.length - 1] ?? { type: 'league' };
}

// ─── Helpers genéricos ────────────────────────────────────────────────────────
export function sortStandings(standings: IStanding[]): IStanding[] {
    return [...standings].sort((a, b) => {
        const pts = b.points - a.points;
        if (pts !== 0) return pts;
        const sg = (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
        if (sg !== 0) return sg;
        return b.goalsFor - a.goalsFor;
    });
}

export function updateStandings(
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

    home.teamName = homeName; home.teamEmoji = homeEmoji;
    away.teamName = awayName; away.teamEmoji = awayEmoji;

    home.games++; away.games++;
    home.goalsFor += hG; home.goalsAgainst += aG;
    away.goalsFor += aG; away.goalsAgainst += hG;

    if (hG > aG)      { home.wins++; home.points += 3; away.losses++; }
    else if (hG < aG) { away.wins++; away.points += 3; home.losses++; }
    else              { home.draws++; home.points++;    away.draws++;  away.points++; }
}

export function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function chunk<T>(arr: T[], n: number): T[][] {
    const r: T[][] = [];
    for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n));
    return r;
}

// Tabela round-robin (algoritmo do círculo). Retorna rodadas de pares [mandante, visitante].
export function generateRoundRobin(teamIds: string[]): string[][][] {
    const ids    = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, 'BYE'];
    const total  = ids.length;
    const rounds: string[][][] = [];

    for (let round = 0; round < total - 1; round++) {
        const pairs: string[][] = [];
        for (let i = 0; i < total / 2; i++) {
            const h = ids[i]; const a = ids[total - 1 - i];
            if (h !== 'BYE' && a !== 'BYE') pairs.push([h, a]);
        }
        rounds.push(pairs);
        ids.splice(1, 0, ids.pop()!);
    }

    return rounds;
}

// Nome do estágio de mata-mata pelo número de CONFRONTOS no estágio
export function bracketStageName(ties: number): string {
    const names: Record<number, string> = {
        1:  'Final',
        2:  'Semifinal',
        4:  'Quartas de Final',
        8:  'Oitavas de Final',
        16: 'Dezesseis-avos de Final',
        32: 'Trinta-e-dois-avos de Final',
    };
    return names[ties] ?? `Fase de ${ties * 2} times`;
}

// Cache nome/emoji de vários times de uma vez
async function fetchTeamInfo(teamIds: string[]): Promise<Map<string, { name: string; emoji: string }>> {
    const uniq  = [...new Set(teamIds.filter(id => id && id !== 'BYE'))];
    const teams = await TeamModel.find({ _id: { $in: uniq } }).catch(() => []);
    const map   = new Map<string, { name: string; emoji: string }>();
    for (const t of teams) map.set(String(t._id), { name: t.name, emoji: t.emoji ?? '⚽' });
    return map;
}

function teamLabel(info: Map<string, { name: string; emoji: string }>, t: ITournament, id: string): string {
    const cached = info.get(id) ?? (() => {
        const s = t.standings.find(s => s.teamId === id);
        return s ? { name: s.teamName, emoji: s.teamEmoji } : { name: `Time (${id.slice(-6)})`, emoji: '⚽' };
    })();
    return `${cached.emoji} **${cached.name}**`;
}

// Disputa de pênaltis simulada (5 cobranças + morte súbita)
export function simulatePenalties(): { home: number; away: number } {
    let home = 0, away = 0;
    for (let i = 0; i < 5; i++) {
        if (Math.random() < 0.76) home++;
        if (Math.random() < 0.76) away++;
    }
    while (home === away) {
        if (Math.random() < 0.76) home++;
        if (Math.random() < 0.76) away++;
    }
    return { home, away };
}

// Partida de mata-mata em campo neutro? (final com neutralFinal no formato)
export function isNeutralMatch(t: ITournament, match: ITourneyMatch): boolean {
    if (!match.bracketRound) return false;
    const phase = getCurrentPhase(t);
    return match.bracketRound === 'Final' && !!phase.neutralFinal;
}

// ─────────────────────────────────────────────────────────────────────────────
// GERAÇÃO DE FASES
// ─────────────────────────────────────────────────────────────────────────────
export async function startPhase(
    t: ITournament,
    phaseIdx: number,
    participants: string[],
    startRound: number,
): Promise<PhaseStartResult> {
    const phase = getPhases(t)[phaseIdx] ?? { type: 'league' as const };
    t.currentPhase    = phaseIdx;
    t.phaseStartRound = startRound;
    t.phaseType       = phase.type;

    switch (phase.type) {
        case 'groups':   return startGroupsPhase(t, phase, participants, startRound);
        case 'knockout': return startKnockoutPhase(t, phase, participants, startRound);
        case 'swiss':    return startSwissPhase(t, phase, participants, startRound);
        default:         return startLeaguePhase(t, phase, participants, startRound);
    }
}

// ─── Liga (pontos corridos) ───────────────────────────────────────────────────
async function startLeaguePhase(t: ITournament, phase: PhaseConfig, participants: string[], startRound: number): Promise<PhaseStartResult> {
    // Corte de pontos (modelo belga): participantes seguem com metade dos pontos
    if (phase.pointsHalved) {
        for (const s of t.standings) {
            if (participants.includes(s.teamId)) s.points = Math.ceil(s.points / 2);
        }
        t.markModified('standings');
    }

    const homeAndAway = phase.homeAndAway ?? true;
    const rounds      = generateRoundRobin(participants);
    const docs: any[] = [];

    for (let r = 0; r < rounds.length; r++) {
        for (const [h, a] of rounds[r]) {
            docs.push({ tournamentId: String(t._id), round: startRound + r, homeTeamId: h, awayTeamId: a, status: 'PENDING' });
        }
    }
    if (homeAndAway) {
        for (let r = 0; r < rounds.length; r++) {
            for (const [h, a] of rounds[r]) {
                docs.push({ tournamentId: String(t._id), round: startRound + rounds.length + r, homeTeamId: a, awayTeamId: h, status: 'PENDING' });
            }
        }
    }
    await TourneyMatchModel.insertMany(docs);

    const total = rounds.length * (homeAndAway ? 2 : 1);
    return {
        roundsGenerated: total,
        estimatedRounds: total,
        description: `📅 Pontos corridos: **${total}** rodada(s) (${homeAndAway ? 'ida e volta' : 'turno único'}) com **${participants.length}** times.${phase.pointsHalved ? '\n✂️ Pontos cortados pela metade!' : ''}`,
    };
}

// ─── Grupos ───────────────────────────────────────────────────────────────────
async function startGroupsPhase(t: ITournament, phase: PhaseConfig, participants: string[], startRound: number): Promise<PhaseStartResult> {
    const groupsCount = phase.groupsCount
        ?? Math.max(1, Math.ceil(participants.length / (phase.teamsPerGroup ?? 4)));
    const groupTeams  = chunk(participants, Math.ceil(participants.length / groupsCount));
    const groups      = groupTeams.map((ids, i) => ({ name: `Grupo ${String.fromCharCode(65 + i)}`, teamIds: ids }));
    t.groups = groups as any;
    t.markModified('groups');

    const homeAndAway = phase.homeAndAway ?? false;
    const docs: any[] = [];
    let maxSubRounds  = 0;

    // Rodadas ALINHADAS entre grupos: rodada N contém os jogos N de todos os grupos
    for (const group of groups) {
        const subRounds = generateRoundRobin(group.teamIds);
        maxSubRounds    = Math.max(maxSubRounds, subRounds.length);
        for (let r = 0; r < subRounds.length; r++) {
            for (const [h, a] of subRounds[r]) {
                docs.push({ tournamentId: String(t._id), round: startRound + r, groupName: group.name, homeTeamId: h, awayTeamId: a, status: 'PENDING' });
            }
        }
    }
    if (homeAndAway) {
        for (const group of groups) {
            const subRounds = generateRoundRobin(group.teamIds);
            for (let r = 0; r < subRounds.length; r++) {
                for (const [h, a] of subRounds[r]) {
                    docs.push({ tournamentId: String(t._id), round: startRound + maxSubRounds + r, groupName: group.name, homeTeamId: a, awayTeamId: h, status: 'PENDING' });
                }
            }
        }
    }
    await TourneyMatchModel.insertMany(docs);

    const total = maxSubRounds * (homeAndAway ? 2 : 1);
    return {
        roundsGenerated: total,
        estimatedRounds: total,
        description: `🗂️ **${groups.length} grupo(s)** (${groups.map(g => `${g.name}: ${g.teamIds.length}`).join(' | ')}) — ${total} rodada(s) ${homeAndAway ? 'ida e volta' : 'turno único'}.`,
    };
}

// ─── Mata-Mata ────────────────────────────────────────────────────────────────
// Gera apenas o PRIMEIRO estágio; os seguintes são gerados por advanceAfterRound.
// `participants` deve vir RANQUEADO (melhor primeiro) — ou embaralhado, se não
// houver campanha anterior. A semeadura (byes + melhor × pior) é feita aqui.
async function startKnockoutPhase(t: ITournament, phase: PhaseConfig, participants: string[], startRound: number): Promise<PhaseStartResult> {
    let size = 1;
    while (size < participants.length) size *= 2;
    const byes = size - participants.length;

    // Semeadura: cabeças de chave recebem os byes; o resto pareia melhor × pior
    const paired: string[] = [];
    for (let i = 0; i < byes; i++) paired.push(participants[i], 'BYE');
    const rest = participants.slice(byes);
    let lo = 0, hi = rest.length - 1;
    while (lo < hi) { paired.push(rest[lo], rest[hi]); lo++; hi--; }
    if (lo === hi) paired.push(rest[lo], 'BYE'); // defensivo (não deve ocorrer)

    const gen = await generateKnockoutStage(t, phase, paired, startRound);

    // Estimativa de rodadas da fase toda (estágios × pernas, final pode ser única)
    const stages = Math.log2(size);
    let estimated = 0;
    for (let ties = size / 2; ties >= 1; ties /= 2) {
        const isFinal = ties === 1;
        estimated += (phase.homeAndAway && !(isFinal && phase.neutralFinal)) ? 2 : 1;
    }

    return {
        roundsGenerated: gen.legs,
        estimatedRounds: estimated,
        description: `⚔️ Mata-mata com **${participants.length}** times (${stages} estágio(s)${phase.homeAndAway ? ', ida e volta' : ', jogo único'}). Começando em: **${gen.stageName}**.${gen.byeNotes.length ? '\n' + gen.byeNotes.join('\n') : ''}`,
    };
}

// Cria as entradas de bracket + partidas de um estágio a partir da lista pareada [a,b,c,d] → a×b, c×d
export async function generateKnockoutStage(
    t: ITournament,
    phase: PhaseConfig,
    orderedTeams: string[],
    startRound: number,
): Promise<{ stageName: string; legs: number; byeNotes: string[] }> {
    const ties      = chunk(orderedTeams, 2);
    const stageName = bracketStageName(ties.length);
    const isFinal   = ties.length === 1;
    const legs      = (phase.homeAndAway && !(isFinal && phase.neutralFinal)) ? 2 : 1;

    const info     = await fetchTeamInfo(orderedTeams);
    const byeNotes: string[] = [];
    const docs: any[] = [];

    for (let i = 0; i < ties.length; i++) {
        const [h, a] = ties[i];
        if (h === 'BYE' && a === 'BYE') continue; // defensivo: par vazio não gera nada

        const hInfo  = h !== 'BYE' ? (info.get(h) ?? { name: '?', emoji: '⚽' }) : { name: 'BYE', emoji: '💤' };
        const aInfo  = a !== 'BYE' ? (info.get(a) ?? { name: '?', emoji: '⚽' }) : { name: 'BYE', emoji: '💤' };

        // BYE → time avança direto, sem partida
        if (h === 'BYE' || a === 'BYE') {
            const winner = h === 'BYE' ? a : h;
            t.bracket.push({
                round: stageName, position: i,
                homeTeamId: h, awayTeamId: a,
                homeTeamName: hInfo.name, awayTeamName: aInfo.name,
                homeTeamEmoji: hInfo.emoji, awayTeamEmoji: aInfo.emoji,
                winnerId: winner, status: 'FINISHED',
            } as any);
            const wInfo = winner === h ? hInfo : aInfo;
            byeNotes.push(`💤 ${wInfo.emoji} **${wInfo.name}** avança direto (bye).`);
            continue;
        }

        t.bracket.push({
            round: stageName, position: i,
            homeTeamId: h, awayTeamId: a,
            homeTeamName: hInfo.name, awayTeamName: aInfo.name,
            homeTeamEmoji: hInfo.emoji, awayTeamEmoji: aInfo.emoji,
            status: 'PENDING',
        } as any);

        docs.push({ tournamentId: String(t._id), round: startRound, bracketRound: stageName, bracketPosition: i, leg: 1, homeTeamId: h, awayTeamId: a, status: 'PENDING' });
        if (legs === 2) {
            docs.push({ tournamentId: String(t._id), round: startRound + 1, bracketRound: stageName, bracketPosition: i, leg: 2, homeTeamId: a, awayTeamId: h, status: 'PENDING' });
        }
    }

    if (docs.length > 0) await TourneyMatchModel.insertMany(docs);
    t.markModified('bracket');
    return { stageName, legs, byeNotes };
}

// ─── Sistema Suíço ────────────────────────────────────────────────────────────
async function startSwissPhase(t: ITournament, phase: PhaseConfig, participants: string[], startRound: number): Promise<PhaseStartResult> {
    // Rodada 1: emparelhamento aleatório. As seguintes usam a classificação.
    const order = shuffle(participants);
    const docs: any[] = [];
    for (let i = 0; i + 1 < order.length; i += 2) {
        docs.push({ tournamentId: String(t._id), round: startRound, homeTeamId: order[i], awayTeamId: order[i + 1], status: 'PENDING' });
    }
    await TourneyMatchModel.insertMany(docs);

    const total = phase.gamesPerTeam ?? 8;
    return {
        roundsGenerated: 1,
        estimatedRounds: total,
        description: `🇨🇭 Fase suíça: cada time joga **${total}** partidas em tabela única. Emparelhamentos gerados rodada a rodada pela classificação.`,
    };
}

// Gera a próxima rodada suíça: pareia por classificação evitando reencontros
export async function generateSwissRound(t: ITournament, round: number): Promise<number> {
    const previous  = await TourneyMatchModel.find({ tournamentId: String(t._id) }, 'homeTeamId awayTeamId');
    const playedSet = new Set(previous.map(m => `${m.homeTeamId}|${m.awayTeamId}`));
    const hasPlayed = (a: string, b: string) => playedSet.has(`${a}|${b}`) || playedSet.has(`${b}|${a}`);

    const pool = sortStandings(t.standings)
        .map(s => s.teamId)
        .filter(id => t.teams.includes(id));

    const docs: any[] = [];
    while (pool.length >= 2) {
        const home = pool.shift()!;
        let oppIdx = pool.findIndex(op => !hasPlayed(home, op));
        if (oppIdx === -1) oppIdx = 0; // sem opção inédita — repete confronto
        const away = pool.splice(oppIdx, 1)[0];
        docs.push({ tournamentId: String(t._id), round, homeTeamId: home, awayTeamId: away, status: 'PENDING' });
    }
    if (docs.length > 0) await TourneyMatchModel.insertMany(docs);
    return docs.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// AVANÇO DE RODADA / FASE
// ─────────────────────────────────────────────────────────────────────────────
// Chamado pelo `round next` quando não há mais jogos PENDING até a rodada atual.
// Retorna a mensagem a exibir para o usuário.
export async function advanceAfterRound(t: ITournament): Promise<string> {
    const phases = getPhases(t);
    const phase  = getCurrentPhase(t);

    // Jogos adiados travam transições de fase (agregados ficariam errados)
    const postponed = await TourneyMatchModel.countDocuments({ tournamentId: String(t._id), round: { $lte: t.currentRound }, status: 'POSTPONED' });

    // 1. A próxima rodada já existe? (meio de fase, ou perna 2 do mata-mata)
    const nextExists = await TourneyMatchModel.exists({ tournamentId: String(t._id), round: t.currentRound + 1 });
    if (nextExists) {
        t.currentRound++;
        await t.save();
        return `➡️ Avançando para a **Rodada ${t.currentRound}** de **${t.name}**.`;
    }

    if (postponed > 0) {
        return `🛑 Há **${postponed}** jogo(s) **adiado(s)** pendente(s). Use \`rp!futebol admin resume\` para remarcar e \`round sim\` para disputá-los antes de avançar de fase.`;
    }

    // 2. Fase suíça: gera a próxima rodada pela classificação
    if (phase.type === 'swiss') {
        const played = t.currentRound - (t.phaseStartRound ?? 1) + 1;
        const target = phase.gamesPerTeam ?? 8;
        if (played < target) {
            await generateSwissRound(t, t.currentRound + 1);
            t.currentRound++;
            await t.save();
            return `🇨🇭 Rodada **${played + 1}/${target}** da fase suíça gerada (Rodada ${t.currentRound} do torneio).`;
        }
        return finishPhase(t, phases, null, []);
    }

    // 3. Mata-mata: resolve o estágio atual (agregado + pênaltis) e gera o próximo
    if (phase.type === 'knockout') {
        const resolved = await resolveKnockoutStage(t, phase);
        if (!resolved) return finishPhase(t, phases, null, []);

        if (resolved.winners.length >= 2) {
            const gen = await generateKnockoutStage(t, phase, resolved.winners, t.currentRound + 1);
            t.currentRound++;
            t.totalRounds = Math.max(t.totalRounds, t.currentRound + gen.legs - 1);
            await t.save();
            return [
                ...resolved.notes,
                `⚔️ **${gen.stageName}** definida! (Rodada ${t.currentRound}${gen.legs === 2 ? ` e ${t.currentRound + 1}` : ''})`,
                ...gen.byeNotes,
                `Use \`rp!futebol round view "${t.name}"\` para ver os confrontos.`,
            ].join('\n');
        }
        return finishPhase(t, phases, resolved.winners, resolved.notes);
    }

    // 4. Liga/Grupos: fase terminou
    return finishPhase(t, phases, null, []);
}

// Resolve todos os confrontos do estágio atual do mata-mata.
// Retorna vencedores ORDENADOS por posição no bracket (para o pareamento seguinte).
async function resolveKnockoutStage(
    t: ITournament,
    phase: PhaseConfig,
): Promise<{ winners: string[]; notes: string[] } | null> {
    // Estágio atual = bracketRound dos jogos na rodada corrente
    const anyMatch = await TourneyMatchModel.findOne({ tournamentId: String(t._id), round: t.currentRound, bracketRound: { $ne: null } });
    const stageName = anyMatch?.bracketRound;
    if (!stageName) return null;

    const entries = t.bracket
        .filter(b => b.round === stageName)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    if (entries.length === 0) return null;

    const matches = await TourneyMatchModel.find({ tournamentId: String(t._id), bracketRound: stageName });
    const notes: string[] = [];
    const winners: string[] = [];

    for (const entry of entries) {
        // BYE já resolvido na geração
        if (entry.status === 'FINISHED' && entry.winnerId) {
            winners.push(entry.winnerId);
            continue;
        }

        const tieMatches = matches
            .filter(m => m.bracketPosition === entry.position)
            .sort((a, b) => (a.leg ?? 1) - (b.leg ?? 1));
        if (tieMatches.length === 0) continue;

        // Agregado: perna 1 tem mando de entry.homeTeamId; perna 2 é invertida
        let aggHome = 0, aggAway = 0;
        for (const m of tieMatches) {
            if (m.homeTeamId === entry.homeTeamId) { aggHome += m.homeScore; aggAway += m.awayScore; }
            else                                    { aggHome += m.awayScore; aggAway += m.homeScore; }
        }

        let winnerId: string;
        const label = `${entry.homeTeamEmoji ?? '⚽'} **${entry.homeTeamName}** ${aggHome} × ${aggAway} **${entry.awayTeamName}** ${entry.awayTeamEmoji ?? '⚽'}`;

        if (aggHome > aggAway)      winnerId = entry.homeTeamId!;
        else if (aggAway > aggHome) winnerId = entry.awayTeamId!;
        else {
            // Empate no agregado → pênaltis (registrados na última perna)
            const pens      = simulatePenalties();
            const decider   = tieMatches[tieMatches.length - 1];
            const homeIsEntryHome = decider.homeTeamId === entry.homeTeamId;
            decider.penHome = homeIsEntryHome ? pens.home : pens.away;
            decider.penAway = homeIsEntryHome ? pens.away : pens.home;
            await decider.save();

            winnerId = pens.home > pens.away
                ? (homeIsEntryHome ? entry.homeTeamId! : entry.awayTeamId!)
                : (homeIsEntryHome ? entry.awayTeamId!  : entry.homeTeamId!);
            const wName = winnerId === entry.homeTeamId ? entry.homeTeamName : entry.awayTeamName;
            notes.push(`🥅 ${label} — **${wName}** vence nos pênaltis (**${pens.home}-${pens.away}**)!`);
        }

        if (aggHome !== aggAway) {
            const wName = winnerId === entry.homeTeamId ? entry.homeTeamName : entry.awayTeamName;
            notes.push(`✅ ${label} — **${wName}** avança.${tieMatches.length === 2 ? ' *(agregado)*' : ''}`);
        }

        entry.homeScore = aggHome;
        entry.awayScore = aggAway;
        entry.winnerId  = winnerId;
        entry.status    = 'FINISHED';
        winners.push(winnerId);
    }

    t.markModified('bracket');
    return { winners, notes };
}

// ─── Fim de fase: transição ou título ─────────────────────────────────────────
async function finishPhase(
    t: ITournament,
    phases: PhaseConfig[],
    knockoutWinners: string[] | null,
    notes: string[],
): Promise<string> {
    const phase  = getCurrentPhase(t);
    const isLast = (t.currentPhase ?? 0) >= phases.length - 1;

    if (isLast) {
        // Campeão: vencedor da final (mata-mata) ou líder da tabela
        let championId = knockoutWinners?.[0];
        if (!championId) championId = sortStandings(t.standings)[0]?.teamId;

        const st  = t.standings.find(s => s.teamId === championId);
        t.championId   = championId;
        t.championName = st?.teamName ?? 'Desconhecido';
        t.status       = 'FINISHED';
        await t.save();

        return [
            ...notes,
            `🏆 **${t.name}** chegou ao fim!`,
            `👑 **CAMPEÃO:** ${st?.teamEmoji ?? '🏆'} **${t.championName}**`,
            `Use \`rp!futebol standings "${t.name}"\` para a classificação final.`,
        ].join('\n');
    }

    // Qualificados para a próxima fase
    const q = await computeQualifiers(t, phase, knockoutWinners);
    t.carryOverTeams = q.carryOver;

    let participants = q.qualified;
    if (participants.length < 2) participants = [...t.teams]; // fase reaproveita todos (ex: liga após copa)

    const nextIdx    = (t.currentPhase ?? 0) + 1;
    const nextPhase  = phases[nextIdx];
    const startRound = t.currentRound + 1;

    const gen = await startPhase(t, nextIdx, participants, startRound);
    t.currentRound = startRound;
    t.totalRounds  = Math.max(t.totalRounds, startRound + gen.estimatedRounds - 1);
    await t.save();

    return [
        ...notes,
        ...q.notes,
        `🚩 **NOVA FASE:** ${nextPhase.name ?? nextPhase.type} — **${participants.length}** time(s). (a partir da Rodada ${startRound})`,
        gen.description,
    ].filter(Boolean).join('\n');
}

// Determina quem avança da fase atual (e quem "pula" a próxima via carryOver)
async function computeQualifiers(
    t: ITournament,
    phase: PhaseConfig,
    knockoutWinners: string[] | null,
): Promise<{ qualified: string[]; carryOver: string[]; notes: string[] }> {
    const notes: string[] = [];
    const phases   = getPhases(t);
    const nextPhase = phases[(t.currentPhase ?? 0) + 1];

    // Mata-mata intermediário: vencedores + times que estavam esperando (carryOver)
    // Pré-classificados entram como cabeças de chave (topo do ranking)
    if (phase.type === 'knockout') {
        const winners = knockoutWinners ?? [];
        const carried = t.carryOverTeams ?? [];
        if (carried.length > 0) notes.push(`🎟️ **${carried.length}** time(s) pré-classificado(s) entram nesta fase.`);
        return { qualified: [...carried, ...winners], carryOver: [], notes };
    }

    // Suíço: top N direto (pula o playoff) + faixa do playoff
    if (phase.type === 'swiss') {
        const sorted = sortStandings(t.standings).map(s => s.teamId).filter(id => t.teams.includes(id));
        const direct = phase.directAdvancing ?? 0;
        const spots  = phase.playoffSpots ?? 0;
        if (spots > 0 && phases[(t.currentPhase ?? 0) + 2]) {
            const playoffTeams = sorted.slice(direct, direct + spots);
            notes.push(`✅ Top **${direct}** avançam direto; posições ${direct + 1}–${direct + spots} disputam o playoff.`);
            return { qualified: playoffTeams, carryOver: sorted.slice(0, direct), notes };
        }
        const count = direct > 0 ? direct : sorted.length;
        return { qualified: sorted.slice(0, count), carryOver: [], notes };
    }

    // Grupos: top N por grupo + melhores terceiros
    if (phase.type === 'groups' && t.groups?.length > 0) {
        const perGroup = phase.advancingPerGroup ?? 2;
        const qualified: string[] = [];
        const thirds: IStanding[] = [];

        const groupTables: Record<string, IStanding[]> = {};
        for (const g of t.groups) {
            const table = sortStandings(t.standings.filter(s => g.teamIds.includes(s.teamId)));
            groupTables[g.name] = table;
            qualified.push(...table.slice(0, perGroup).map(s => s.teamId));
            if (phase.bestThirdPlaces && table[perGroup]) thirds.push(table[perGroup]);
        }

        if (phase.bestThirdPlaces && thirds.length > 0) {
            const best = sortStandings(thirds).slice(0, phase.bestThirdPlaces);
            qualified.push(...best.map(s => s.teamId));
            notes.push(`🎫 **${best.length}** melhor(es) 3º(s) colocado(s) também avançam: ${best.map(s => `**${s.teamName}**`).join(', ')}.`);
        }

        notes.push(`✅ **${qualified.length}** classificados da fase de grupos.`);
        // Ordena por campanha geral — o mata-mata seguinte semeia melhor × pior
        const rank = new Map(sortStandings(t.standings).map((s, i) => [s.teamId, i]));
        qualified.sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99));
        return { qualified, carryOver: [], notes };
    }

    // Liga: corte por advancingToPlayoffs / teamsInvolved da próxima fase
    const phaseTeamIds = await getPhaseParticipants(t);
    const sorted = sortStandings(t.standings.filter(s => phaseTeamIds.has(s.teamId))).map(s => s.teamId);
    let count = phase.advancingToPlayoffs ?? nextPhase?.teamsInvolved ?? sorted.length;
    if (phase.advancingToPlayIn) count += phase.advancingToPlayIn;
    const qualified = sorted.slice(0, count);
    if (count < sorted.length) notes.push(`✅ Top **${count}** avançam para a próxima fase.`);
    return { qualified, carryOver: [], notes };
}

// Times que efetivamente jogaram a fase atual (para ligas pós-fase inicial, ex: playoff belga)
async function getPhaseParticipants(t: ITournament): Promise<Set<string>> {
    const matches = await TourneyMatchModel.find(
        { tournamentId: String(t._id), round: { $gte: t.phaseStartRound ?? 1, $lte: t.currentRound } },
        'homeTeamId awayTeamId',
    );
    const set = new Set<string>();
    for (const m of matches) { set.add(m.homeTeamId); set.add(m.awayTeamId); }
    if (set.size === 0) for (const id of t.teams) set.add(id);
    return set;
}

