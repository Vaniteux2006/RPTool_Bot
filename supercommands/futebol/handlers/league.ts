import { Message, EmbedBuilder } from 'discord.js';
import {
    TournamentModel,
    TeamModel,
    TourneyMatchModel,
    IStanding,
} from '../../../tools/models/FutebolSchema';
import { extractArgs } from '../../../tools/utils/textUtils';
import path from 'path';
import fs from 'fs';

interface FormatConfig {
    name: string;
    flag: string;
    description: string;
    minTeams: number;
    maxTeams: number;
    phases: any[];
    relegation?: number;
    relegationPlayoff?: number;
}

function loadFormats(): Record<string, FormatConfig> {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../data/formats.json'), 'utf-8'));
}

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Determina o tipo de fase principal de um formato
function resolvePrimaryPhaseType(cfg: FormatConfig): 'league' | 'groups' | 'knockout' | 'swiss' {
    const firstPhase = cfg.phases?.[0]?.type;
    if (firstPhase === 'groups')   return 'groups';
    if (firstPhase === 'knockout') return 'knockout';
    if (firstPhase === 'swiss')    return 'swiss';
    return 'league';
}

// Gera tabela round-robin (pontos corridos)
function generateRoundRobin(teamIds: string[]): string[][][] {
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

// Nomes das rodadas de mata-mata por profundidade
const BRACKET_ROUND_NAMES: Record<number, string> = {
    1:   'Final',
    2:   'Semifinal',
    4:   'Quartas de Final',
    8:   'Oitavas de Final',
    16:  'Dezesseis-avos',
    32:  'Trigésimos-segundos',
    64:  'Rodada 1',
    128: 'Rodada 0',
};

function getBracketRoundName(teamsLeft: number): string {
    return BRACKET_ROUND_NAMES[teamsLeft] ?? `Rodada (${teamsLeft} times)`;
}

// ─── rp!futebol tourney create "Nome" [FORMATO] ──────────────────────────────
export async function handleTourneyCreate(message: Message, args: string[]) {
    const formats   = loadFormats();
    const cleanArgs = extractArgs(message.content, 'tourney create');

    if (cleanArgs.length < 1) {
        const list = Object.entries(formats)
            .map(([k, v]) => `▸ \`${k}\` — ${v.flag} ${v.name}`)
            .join('\n');
        return message.reply(`⚠️ **Uso:** \`rp!futebol tourney create "Nome" [FORMATO]\`\n\n**Formatos disponíveis:**\n${list}`);
    }

    if (!message.guild!.members.cache.get(message.author.id)?.permissions.has('ManageGuild')) {
        return message.reply('❌ Apenas administradores podem criar torneios.');
    }

    const tourneyName = cleanArgs[0];
    const format      = (cleanArgs[1] ?? 'BR').toUpperCase();

    if (!formats[format]) {
        return message.reply(`❌ Formato inválido: \`${format}\`. Use \`rp!futebol tourney create\` para ver a lista.`);
    }

    const exists = await TournamentModel.findOne({ guildId: message.guild!.id, name: new RegExp(`^${escapeRegex(tourneyName)}$`, 'i') });
    if (exists) return message.reply(`❌ Já existe um torneio **${tourneyName}** neste servidor.`);

    const cfg         = formats[format];
    const phaseType   = resolvePrimaryPhaseType(cfg);

    const tournament = await TournamentModel.create({
        guildId:   message.guild!.id,
        name:      tourneyName,
        format,
        phaseType,
        status:    'ENROLLING',
    });

    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle(`🏆 Torneio Criado: ${tourneyName}`)
        .setDescription(
            `${cfg.flag} **Formato:** ${cfg.name}\n📖 ${cfg.description}\n\n` +
            `**Inscrições abertas!**\n` +
            `Use \`rp!futebol join "${tourneyName}" "Seu Time"\` para participar.\n` +
            `Quando todos estiverem inscritos, use \`rp!futebol tourney start "${tourneyName}"\`.`,
        )
        .addFields(
            { name: '👥 Mín.', value: String(cfg.minTeams), inline: true },
            { name: '👥 Máx.', value: String(cfg.maxTeams), inline: true },
            { name: '⬇️ Rebaixamento', value: cfg.relegation ? String(cfg.relegation) : 'N/A', inline: true },
            { name: '🗂️ Tipo de Fase', value: phaseType, inline: true },
        )
        .setFooter({ text: `ID: ${tournament._id}` });

    return message.reply({ embeds: [embed] });
}

// ─── rp!futebol join "Torneio" "Time" ─────────────────────────────────────────
export async function handleJoinTourney(message: Message, args: string[], userId: string) {
    const cleanArgs = extractArgs(message.content, 'join');
    if (cleanArgs.length < 2) return message.reply('⚠️ **Uso:** `rp!futebol join "Nome do Torneio" "Nome do Time"`');

    const [tourneyName, teamName] = cleanArgs;

    const tournament = await TournamentModel.findOne({ guildId: message.guild!.id, name: new RegExp(`^${escapeRegex(tourneyName)}$`, 'i') });
    if (!tournament)                          return message.reply(`❌ Torneio **${tourneyName}** não encontrado.`);
    if (tournament.status !== 'ENROLLING')    return message.reply('❌ As inscrições estão encerradas.');

    const formats = loadFormats();
    const cfg     = formats[tournament.format];
    if (cfg && tournament.teams.length >= cfg.maxTeams) return message.reply(`❌ Limite de **${cfg.maxTeams}** times atingido.`);

    const team = await TeamModel.findOne({ adminId: userId, name: new RegExp(`^${escapeRegex(teamName)}$`, 'i'), guildOriginId: message.guild!.id });
    if (!team)                             return message.reply(`❌ Você não é o dono de **${teamName}** neste servidor.`);
    if (tournament.teams.includes(team.id)) return message.reply('❌ Seu time já está inscrito.');

    tournament.teams.push(team.id);
    // ← cache de nome e emoji na standings desde a inscrição
    tournament.standings.push({
        teamId:       team.id,
        teamName:     team.name,
        teamEmoji:    team.emoji ?? '⚽',
        points:       0, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0,
    });
    await tournament.save();

    return message.reply(`✅ ${team.emoji ?? '⚽'} **${team.name}** inscrito em **${tournament.name}**! (${tournament.teams.length} inscritos)`);
}

// ─── rp!futebol tourney start "Torneio" ──────────────────────────────────────
export async function handleTourneyStart(message: Message, args: string[]) {
    if (!message.guild!.members.cache.get(message.author.id)?.permissions.has('ManageGuild')) {
        return message.reply('❌ Apenas administradores podem iniciar torneios.');
    }

    const cleanArgs = extractArgs(message.content, 'tourney start');
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol tourney start "Nome do Torneio"`');

    const tournament = await TournamentModel.findOne({ guildId: message.guild!.id, name: new RegExp(`^${escapeRegex(cleanArgs[0])}$`, 'i') });
    if (!tournament)                         return message.reply('❌ Torneio não encontrado.');
    if (tournament.status !== 'ENROLLING')   return message.reply('❌ Torneio já iniciado ou encerrado.');

    const formats = loadFormats();
    const cfg     = formats[tournament.format];
    if (cfg && tournament.teams.length < cfg.minTeams) {
        return message.reply(`❌ Mínimo de **${cfg.minTeams}** times necessário. Inscritos: **${tournament.teams.length}**.`);
    }

    const shuffled = [...tournament.teams].sort(() => Math.random() - 0.5);

    const phaseType = tournament.phaseType;

    // ─── Liga (pontos corridos) ───────────────────────────────────────────────
    if (phaseType === 'league') {
        const rounds      = generateRoundRobin(shuffled);
        const homeAndAway = cfg?.phases?.[0]?.homeAndAway ?? true;

        for (let r = 0; r < rounds.length; r++) {
            for (const [h, a] of rounds[r]) {
                await TourneyMatchModel.create({ tournamentId: tournament.id, round: r + 1, homeTeamId: h, awayTeamId: a, status: 'PENDING' });
            }
        }
        if (homeAndAway) {
            for (let r = 0; r < rounds.length; r++) {
                for (const [h, a] of rounds[r]) {
                    await TourneyMatchModel.create({ tournamentId: tournament.id, round: rounds.length + r + 1, homeTeamId: a, awayTeamId: h, status: 'PENDING' });
                }
            }
            tournament.totalRounds = rounds.length * 2;
        } else {
            tournament.totalRounds = rounds.length;
        }
    }

    // ─── Grupos ───────────────────────────────────────────────────────────────
    else if (phaseType === 'groups') {
        const groupsCount = cfg?.phases?.[0]?.groupsCount ?? 2;
        const groupTeams  = chunk(shuffled, Math.ceil(shuffled.length / groupsCount));
        const groupNames  = groupTeams.map((_, i) => `Grupo ${String.fromCharCode(65 + i)}`); // A, B, C…

        const groups = groupTeams.map((ids, i) => ({ name: groupNames[i], teamIds: ids }));
        tournament.groups = groups as any;

        let round = 1;
        for (const group of groups) {
            const subRounds = generateRoundRobin(group.teamIds);
            for (const subRound of subRounds) {
                for (const [h, a] of subRound) {
                    await TourneyMatchModel.create({
                        tournamentId: tournament.id, round,
                        groupName: group.name,
                        homeTeamId: h, awayTeamId: a, status: 'PENDING',
                    });
                }
                round++;
            }
        }
        tournament.totalRounds = round - 1;
    }

    // ─── Mata-Mata direto ─────────────────────────────────────────────────────
    else if (phaseType === 'knockout') {
        // Garante potência de 2
        let size = 1;
        while (size < shuffled.length) size *= 2;
        const padded = [...shuffled];
        while (padded.length < size) padded.push('BYE');

        let currentPairs = chunk(padded, 2);
        let roundNum     = 1;

        for (let depth = size; depth > 1; depth /= 2) {
            const roundName = getBracketRoundName(depth / 2 === 1 ? 1 : depth);
            for (let i = 0; i < currentPairs.length; i++) {
                const [h, a] = currentPairs[i];
                if (h === 'BYE' || a === 'BYE') continue;
                await TourneyMatchModel.create({
                    tournamentId:    tournament.id,
                    round:           roundNum,
                    bracketRound:    roundName,
                    bracketPosition: i,
                    homeTeamId:      h,
                    awayTeamId:      a,
                    status:          'PENDING',
                });
            }
            roundNum++;
            // Próxima rodada será preenchida dinamicamente após os jogos
            break; // Só gera a primeira rodada; as próximas são geradas após resultados
        }
        tournament.totalRounds = Math.log2(size);
    }

    tournament.status       = 'ACTIVE';
    tournament.currentRound = 1;
    await tournament.save();

    return message.reply(
        `🏁 **${tournament.name}** iniciado! ${tournament.totalRounds} rodada(s).\n` +
        `Use \`rp!futebol round sim "${tournament.name}"\` para simular.`,
    );
}

// ─── rp!futebol standings "Torneio" ──────────────────────────────────────────
export async function handleStandings(message: Message, args: string[]) {
    const cleanArgs = extractArgs(message.content, 'standings');
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol standings "Nome do Torneio"`');

    const tournament = await TournamentModel.findOne({ guildId: message.guild!.id, name: new RegExp(`^${escapeRegex(cleanArgs[0])}$`, 'i') });
    if (!tournament) return message.reply('❌ Torneio não encontrado.');

    const formats = loadFormats();
    const cfg     = formats[tournament.format];
    const relZone = cfg?.relegation ?? 0;

    const sorted = [...tournament.standings].sort((a, b) => {
        const pts = b.points - a.points;
        if (pts !== 0) return pts;
        const sg = (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
        if (sg !== 0) return sg;
        return b.goalsFor - a.goalsFor;
    });

    const lines = sorted.map((s: IStanding, i: number) => {
        const pos    = i + 1;
        const sg     = s.goalsFor - s.goalsAgainst;
        const relMark = relZone > 0 && pos > sorted.length - relZone ? '🔴 ' : '';
        // Usa nome e emoji cacheados — sem lookup extra no banco!
        return (
            `\`${String(pos).padStart(2)}\` ${relMark}${s.teamEmoji} **${s.teamName}** — ` +
            `**${s.points}pts** | ${s.games}J ${s.wins}V ${s.draws}E ${s.losses}D | ` +
            `SG:${sg >= 0 ? '+' : ''}${sg} | GP:${s.goalsFor}`
        );
    });

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`📊 Tabela — ${tournament.name}`)
        .setDescription(lines.join('\n') || '*Sem jogos disputados.*')
        .addFields({ name: '📅 Rodada Atual', value: `${tournament.currentRound}/${tournament.totalRounds}`, inline: true })
        .setFooter({ text: relZone > 0 ? `🔴 Zona de rebaixamento: últimos ${relZone} times` : 'Sem rebaixamento' });

    return message.reply({ embeds: [embed] });
}

function chunk<T>(arr: T[], n: number): T[][] {
    const r: T[][] = [];
    for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n));
    return r;
}