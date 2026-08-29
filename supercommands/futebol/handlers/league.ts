import { Message, EmbedBuilder } from 'discord.js';
import {
    TournamentModel,
    TeamModel,
    TourneyMatchModel,
    IStanding,
    ITournament,
} from '../../../tools/models/FutebolSchema';
import { extractArgs } from '../../../tools/utils/textUtils';
import {
    loadFormats,
    getFormatConfig,
    getCurrentPhase,
    startPhase,
    sortStandings,
    shuffle,
    FormatConfig,
} from '../engines/progression';

import { escapeRegex } from '../../../tools/utils/text';
import { isStaff as isGuildAdmin } from '../../../tools/utils/discord/permissions';

// Determina o tipo de fase principal de um formato
function resolvePrimaryPhaseType(cfg: FormatConfig): 'league' | 'groups' | 'knockout' | 'swiss' {
    const firstPhase = cfg.phases?.[0]?.type;
    if (firstPhase === 'groups')   return 'groups';
    if (firstPhase === 'knockout') return 'knockout';
    if (firstPhase === 'swiss')    return 'swiss';
    return 'league';
}

// ─── Flags de customização do tourney create ─────────────────────────────────
// -ida (ida e volta) | -turno (turno único) | -grupos N | -avanca N | -min N | -max N
function applyFormatOverrides(cfg: FormatConfig, tokens: string[]): { cfg: FormatConfig; applied: string[] } {
    const out: FormatConfig = JSON.parse(JSON.stringify(cfg));
    const applied: string[] = [];

    const numAfter = (flag: string): number | null => {
        const i = tokens.indexOf(flag);
        if (i === -1) return null;
        const n = parseInt(tokens[i + 1] ?? '', 10);
        return isNaN(n) ? null : n;
    };

    if (tokens.includes('-ida')) {
        out.phases.forEach(p => { if (p.type === 'league' || p.type === 'groups') p.homeAndAway = true; });
        applied.push('ida e volta');
    }
    if (tokens.includes('-turno')) {
        out.phases.forEach(p => { if (p.type === 'league' || p.type === 'groups') p.homeAndAway = false; });
        applied.push('turno único');
    }

    const grupos = numAfter('-grupos');
    if (grupos !== null && grupos >= 1) {
        const gPhase = out.phases.find(p => p.type === 'groups');
        if (gPhase) { gPhase.groupsCount = grupos; applied.push(`${grupos} grupos`); }
    }

    const avanca = numAfter('-avanca');
    if (avanca !== null && avanca >= 1) {
        const gPhase = out.phases.find(p => p.type === 'groups');
        if (gPhase) { gPhase.advancingPerGroup = avanca; applied.push(`${avanca} avançam por grupo`); }
        const lPhase = out.phases.find(p => p.type === 'league');
        if (!gPhase && lPhase && out.phases.length > 1) { lPhase.advancingToPlayoffs = avanca; applied.push(`top ${avanca} aos playoffs`); }
    }

    const min = numAfter('-min');
    if (min !== null && min >= 2) { out.minTeams = min; applied.push(`mín. ${min}`); }
    const max = numAfter('-max');
    if (max !== null && max >= 2) { out.maxTeams = max; applied.push(`máx. ${max}`); }

    return { cfg: out, applied };
}

// ─── rp!futebol tourney create "Nome" [FORMATO] [flags] ──────────────────────
export async function handleTourneyCreate(message: Message, args: string[]) {
    const formats   = loadFormats();
    const cleanArgs = extractArgs(message.content, 'tourney create');

    if (cleanArgs.length < 1) {
        const list = Object.entries(formats)
            .map(([k, v]) => `▸ \`${k}\` — ${v.flag} ${v.name}`)
            .join('\n');
        return message.reply(
            `⚠️ **Uso:** \`rp!futebol tourney create "Nome" [FORMATO] [flags]\`\n\n` +
            `**Formatos disponíveis:**\n${list}\n\n` +
            `**Flags de customização:**\n` +
            `\`-ida\` ida e volta | \`-turno\` turno único | \`-grupos N\` | \`-avanca N\` | \`-min N\` | \`-max N\``,
        );
    }

    if (!isGuildAdmin(message)) {
        return message.reply('❌ Apenas administradores podem criar torneios.');
    }

    const tourneyName = cleanArgs[0];
    const positional  = cleanArgs.slice(1).filter((tok, i, arr) => {
        if (tok.startsWith('-')) return false;
        // descarta números que são valor de uma flag (-grupos 4)
        if (i > 0 && arr[i - 1].startsWith('-') && !isNaN(parseInt(tok, 10))) return false;
        return true;
    });
    const format = (positional[0] ?? 'BR').toUpperCase();

    if (!formats[format]) {
        return message.reply(`❌ Formato inválido: \`${format}\`. Use \`rp!futebol tourney create\` para ver a lista.`);
    }

    const exists = await TournamentModel.findOne({ guildId: message.guild!.id, name: new RegExp(`^${escapeRegex(tourneyName)}$`, 'i') });
    if (exists) return message.reply(`❌ Já existe um torneio **${tourneyName}** neste servidor.`);

    const { cfg, applied } = applyFormatOverrides(formats[format], cleanArgs);
    const phaseType        = resolvePrimaryPhaseType(cfg);

    const tournament = await TournamentModel.create({
        guildId:      message.guild!.id,
        name:         tourneyName,
        format,
        phaseType,
        status:       'ENROLLING',
        formatConfig: cfg, // snapshot: mudanças futuras no formats.json não afetam este torneio
    });

    const phaseList = cfg.phases
        .map((p, i) => `\`${i + 1}.\` ${p.name ?? p.type}${p.homeAndAway ? ' *(ida/volta)*' : ''}`)
        .join('\n');

    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle(`🏆 Torneio Criado: ${tourneyName}`)
        .setDescription(
            `${cfg.flag ?? '⚽'} **Formato:** ${cfg.name ?? format}\n📖 ${cfg.description ?? ''}\n\n` +
            `**Fases:**\n${phaseList}\n\n` +
            (applied.length > 0 ? `🔧 **Customizações:** ${applied.join(', ')}\n\n` : '') +
            `**Inscrições abertas!**\n` +
            `Use \`rp!futebol join "${tourneyName}" "Seu Time"\` para participar.\n` +
            `Quando todos estiverem inscritos, use \`rp!futebol tourney start "${tourneyName}"\`.`,
        )
        .addFields(
            { name: '👥 Mín.', value: String(cfg.minTeams), inline: true },
            { name: '👥 Máx.', value: String(cfg.maxTeams), inline: true },
            { name: '⬇️ Rebaixamento', value: cfg.relegation ? String(cfg.relegation) : 'N/A', inline: true },
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

    const cfg = getFormatConfig(tournament);
    if (tournament.teams.length >= cfg.maxTeams) return message.reply(`❌ Limite de **${cfg.maxTeams}** times atingido.`);

    // 1º: time do usuário neste servidor; 2º: time GLOBAL do usuário (qualquer servidor)
    const nameRx = new RegExp(`^${escapeRegex(teamName)}$`, 'i');
    let team = await TeamModel.findOne({ adminId: userId, name: nameRx, guildOriginId: message.guild!.id });
    let viaGlobal = false;
    if (!team) {
        team = await TeamModel.findOne({ adminId: userId, name: nameRx, isGlobal: true });
        viaGlobal = !!team;
    }
    if (!team) {
        return message.reply(
            `❌ Você não é o dono de **${teamName}** neste servidor.\n` +
            `-# Para usar um time seu de outro servidor, torne-o global com \`rp!futebol global "${teamName}" on\` (no servidor de origem).`,
        );
    }
    if (tournament.teams.includes(team.id)) return message.reply('❌ Seu time já está inscrito.');

    tournament.teams.push(team.id);
    tournament.standings.push({
        teamId:       team.id,
        teamName:     team.name,
        teamEmoji:    team.emoji ?? '⚽',
        points:       0, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0,
    });
    await tournament.save();

    return message.reply(
        `✅ ${team.emoji ?? '⚽'} **${team.name}** inscrito em **${tournament.name}**! ` +
        `(${tournament.teams.length}/${cfg.maxTeams} inscritos)${viaGlobal ? '\n-# 🌍 Inscrito como time global de outro servidor.' : ''}`,
    );
}

// ─── rp!futebol tourney start "Torneio" ──────────────────────────────────────
export async function handleTourneyStart(message: Message, args: string[]) {
    if (!isGuildAdmin(message)) {
        return message.reply('❌ Apenas administradores podem iniciar torneios.');
    }

    const cleanArgs = extractArgs(message.content, 'tourney start');
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol tourney start "Nome do Torneio"`');

    const tournament = await TournamentModel.findOne({ guildId: message.guild!.id, name: new RegExp(`^${escapeRegex(cleanArgs[0])}$`, 'i') });
    if (!tournament)                         return message.reply('❌ Torneio não encontrado.');
    if (tournament.status !== 'ENROLLING')   return message.reply('❌ Torneio já iniciado ou encerrado.');

    const cfg = getFormatConfig(tournament);
    if (tournament.teams.length < cfg.minTeams) {
        return message.reply(`❌ Mínimo de **${cfg.minTeams}** times necessário. Inscritos: **${tournament.teams.length}**.`);
    }

    const shuffled = shuffle(tournament.teams);
    const gen      = await startPhase(tournament, 0, shuffled, 1);

    tournament.status       = 'ACTIVE';
    tournament.currentRound = 1;
    tournament.totalRounds  = gen.estimatedRounds;
    await tournament.save();

    return message.reply(
        `🏁 **${tournament.name}** iniciado!\n${gen.description}\n\n` +
        `Use \`rp!futebol round sim "${tournament.name}"\` para simular a rodada ` +
        `e \`rp!futebol round next "${tournament.name}"\` para avançar.`,
    );
}

// ─── rp!futebol standings "Torneio" ──────────────────────────────────────────
export async function handleStandings(message: Message, args: string[]) {
    const cleanArgs = extractArgs(message.content, 'standings');
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol standings "Nome do Torneio"`');

    const tournament = await TournamentModel.findOne({ guildId: message.guild!.id, name: new RegExp(`^${escapeRegex(cleanArgs[0])}$`, 'i') });
    if (!tournament) return message.reply('❌ Torneio não encontrado.');

    const cfg     = getFormatConfig(tournament);
    const phase   = getCurrentPhase(tournament);
    const relZone = phase.type === 'league' ? (cfg.relegation ?? 0) : 0;

    const fmtLine = (s: IStanding, pos: number, total: number) => {
        const sg      = s.goalsFor - s.goalsAgainst;
        const relMark = relZone > 0 && pos > total - relZone ? '🔴 ' : '';
        const champMark = tournament.status === 'FINISHED' && s.teamId === tournament.championId ? '👑 ' : '';
        return (
            `\`${String(pos).padStart(2)}\` ${champMark}${relMark}${s.teamEmoji} **${s.teamName}** — ` +
            `**${s.points}pts** | ${s.games}J ${s.wins}V ${s.draws}E ${s.losses}D | ` +
            `SG:${sg >= 0 ? '+' : ''}${sg} | GP:${s.goalsFor}`
        );
    };

    const embed = new EmbedBuilder()
        .setColor(tournament.status === 'FINISHED' ? 'Gold' : 'Blue')
        .setTitle(`📊 Tabela — ${tournament.name}`)
        .addFields({ name: '📅 Rodada', value: `${tournament.currentRound}/${tournament.totalRounds}`, inline: true },
                   { name: '🗂️ Fase',   value: phase.name ?? phase.type, inline: true });

    if (tournament.status === 'FINISHED' && tournament.championName) {
        embed.addFields({ name: '👑 Campeão', value: `**${tournament.championName}**`, inline: true });
    }

    // Fase de grupos: uma tabela por grupo
    if (phase.type === 'groups' && tournament.groups?.length > 0) {
        for (const g of tournament.groups) {
            const table = sortStandings(tournament.standings.filter(s => g.teamIds.includes(s.teamId)));
            embed.addFields({
                name:   `**${g.name}**`,
                value:  table.map((s, i) => fmtLine(s, i + 1, table.length)).join('\n') || '*Sem jogos.*',
                inline: false,
            });
        }
    } else {
        const sorted = sortStandings(tournament.standings);
        embed.setDescription(sorted.map((s, i) => fmtLine(s, i + 1, sorted.length)).join('\n') || '*Sem jogos disputados.*');
    }

    embed.setFooter({ text: relZone > 0 ? `🔴 Zona de rebaixamento: últimos ${relZone} times` : (phase.name ?? 'Classificação') });

    return message.reply({ embeds: [embed] });
}

// ─── rp!futebol tourney view "Torneio" ───────────────────────────────────────
// Raio-X do torneio: status, fase atual, jogos da rodada e chaveamento completo
// (todos os estágios do mata-mata, incluindo os já disputados).
export async function handleTourneyView(message: Message, args: string[]) {
    // aceita "tourney view", "tourney info" e "tourney status"
    const cleanArgs = extractArgs(message.content, `tourney ${args[1] ?? 'view'}`);
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol tourney view "Nome do Torneio"`');

    const tournament = await TournamentModel.findOne({ guildId: message.guild!.id, name: new RegExp(`^${escapeRegex(cleanArgs[0])}$`, 'i') });
    if (!tournament) return message.reply('❌ Torneio não encontrado.');

    const cfg    = getFormatConfig(tournament);
    const phase  = getCurrentPhase(tournament);
    const phases = cfg.phases;

    // Nomes/emojis pelo cache da standings — sem lookup de times no banco
    const standingsMap = new Map(tournament.standings.map(s => [s.teamId, s]));
    const label = (id: string) => {
        const s = standingsMap.get(id);
        return s ? `${s.teamEmoji} **${s.teamName}**` : '❓';
    };

    const statusLine = tournament.status === 'ENROLLING'
        ? `📝 **Inscrições abertas** — ${tournament.teams.length}/${cfg.maxTeams} times (mín. ${cfg.minTeams})`
        : tournament.status === 'ACTIVE'
            ? `🟢 **Em andamento** — Rodada **${tournament.currentRound}/${tournament.totalRounds}**`
            : `🏁 **Encerrado**${tournament.championName ? ` — 👑 Campeão: **${tournament.championName}**` : ''}`;

    const phaseIdx  = Math.min(tournament.currentPhase ?? 0, phases.length - 1);
    const phaseLine = phases
        .map((p, i) => {
            const mark = tournament.status === 'FINISHED' || i < phaseIdx ? '✅'
                : (i === phaseIdx && tournament.status === 'ACTIVE') ? '▶️' : '⬜';
            return `${mark} ${p.name ?? p.type}`;
        })
        .join('\n');

    const embed = new EmbedBuilder()
        .setColor(tournament.status === 'FINISHED' ? 'Gold' : tournament.status === 'ACTIVE' ? 'Green' : 'Blue')
        .setTitle(`${cfg.flag ?? '🏆'} ${tournament.name} — Visão Geral`)
        .setDescription(`${statusLine}\n\n**Formato:** ${cfg.name ?? tournament.format}`)
        .addFields({ name: '🗂️ Fases', value: phaseLine, inline: false });

    // ── Inscritos (enquanto não começou) ──────────────────────────────────────
    if (tournament.status === 'ENROLLING') {
        const list = tournament.standings.map(s => `${s.teamEmoji} ${s.teamName}`);
        addChunkedFields(embed, '👥 Inscritos', list.length > 0 ? list : ['*Ninguém ainda.*']);
    }

    // ── Jogos da rodada atual ─────────────────────────────────────────────────
    if (tournament.status === 'ACTIVE') {
        const matches = await TourneyMatchModel.find({ tournamentId: String(tournament._id), round: tournament.currentRound });
        if (matches.length > 0) {
            const lines = matches.map(m => {
                const legTag = m.leg === 2 ? ' *(volta)*' : m.leg === 1 && m.bracketRound ? ' *(ida)*' : '';
                const grpTag = m.groupName ? ` \`${m.groupName.replace('Grupo ', '')}\`` : '';
                if (m.status === 'FINISHED') {
                    const pen = m.penHome != null ? ` *(${m.penHome}-${m.penAway} pên.)*` : '';
                    return `✅${grpTag} ${label(m.homeTeamId)} **${m.homeScore}×${m.awayScore}** ${label(m.awayTeamId)}${pen}${legTag}`;
                }
                if (m.status === 'POSTPONED') return `🛑${grpTag} ${label(m.homeTeamId)} vs ${label(m.awayTeamId)} *(adiado)*`;
                return `⏳${grpTag} ${label(m.homeTeamId)} vs ${label(m.awayTeamId)}${legTag}`;
            });
            const done = matches.filter(m => m.status === 'FINISHED').length;
            addChunkedFields(embed, `📅 Rodada ${tournament.currentRound} (${done}/${matches.length} jogados)`, lines);
        }
    }

    // ── Chaveamento completo (todos os estágios do mata-mata) ─────────────────
    if (tournament.bracket?.length > 0) {
        // Agrupa por estágio preservando a ordem de geração (Oitavas → ... → Final)
        const stageOrder: string[] = [];
        const byStage: Record<string, typeof tournament.bracket> = {};
        for (const entry of tournament.bracket) {
            const stage = entry.round ?? '?';
            if (!byStage[stage]) { byStage[stage] = [] as any; stageOrder.push(stage); }
            byStage[stage].push(entry);
        }

        for (const stage of stageOrder) {
            const lines = byStage[stage]
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                .map(e => {
                    const hE = e.homeTeamEmoji ?? '⚽'; const aE = e.awayTeamEmoji ?? '⚽';
                    if (e.homeTeamId === 'BYE' || e.awayTeamId === 'BYE') {
                        const wName = e.winnerId === e.homeTeamId ? e.homeTeamName : e.awayTeamName;
                        return `💤 **${wName}** avança direto (bye)`;
                    }
                    if (e.status === 'FINISHED') {
                        const wName = e.winnerId === e.homeTeamId ? e.homeTeamName : e.awayTeamName;
                        return `${hE} ${e.homeTeamName} **${e.homeScore}×${e.awayScore}** ${e.awayTeamName} ${aE} → **${wName}**`;
                    }
                    return `⏳ ${hE} ${e.homeTeamName} vs ${e.awayTeamName} ${aE}`;
                });
            addChunkedFields(embed, `🏟️ ${stage}`, lines);
        }
    }

    embed.setFooter({
        text: tournament.status === 'ACTIVE'
            ? `round sim → simula | round next → avança | standings → tabela`
            : `ID: ${tournament._id}`,
    });

    return message.reply({ embeds: [embed] });
}

// Divide listas longas em múltiplos fields (limite de 1024 chars por field do Discord)
function addChunkedFields(embed: EmbedBuilder, name: string, lines: string[]) {
    let buf: string[] = [];
    let part = 0;
    const flush = () => {
        if (buf.length === 0) return;
        embed.addFields({ name: part === 0 ? name : `${name} (cont.)`, value: buf.join('\n'), inline: false });
        buf = []; part++;
    };
    let len = 0;
    for (const line of lines) {
        if (len + line.length + 1 > 1000) { flush(); len = 0; }
        buf.push(line); len += line.length + 1;
    }
    flush();
}
