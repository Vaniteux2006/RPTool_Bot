import { Message } from 'discord.js';
import { TournamentModel, TourneyMatchModel, ITournament, IStanding } from '../../../tools/models/FutebolSchema';
import { extractArgs } from '../../../tools/utils/textUtils';
import { escapeRegex } from '../../../tools/utils/text';
import { isStaff as requireAdmin } from '../../../tools/utils/discord/permissions';

// Busca um time inscrito no torneio pelo nome (via cache da standings — funciona
// inclusive para times globais de outros servidores e times já deletados)
function findEnrolledTeam(tournament: ITournament, teamName: string): IStanding | undefined {
    const lower = teamName.toLowerCase();
    return tournament.standings.find(s => s.teamName.toLowerCase() === lower);
}

// ─── rp!futebol admin punish "Torneio" "Time" -p PONTOS ──────────────────────
export async function handlePunish(message: Message, args: string[]) {
    if (!requireAdmin(message)) return message.reply('❌ Apenas administradores podem aplicar punições.');

    const cleanArgs = extractArgs(message.content, 'admin punish');
    // Espera: ["Nome do Torneio", "Nome do Time", "-p", "3"]
    const pFlag = cleanArgs.indexOf('-p');

    if (cleanArgs.length < 2 || pFlag === -1 || !cleanArgs[pFlag + 1]) {
        return message.reply('⚠️ **Uso:** `rp!futebol admin punish "Torneio" "Time" -p PONTOS`');
    }

    const tourneyName    = cleanArgs[0];
    const teamName       = cleanArgs[1];
    const pointsToDeduct = parseInt(cleanArgs[pFlag + 1], 10);

    if (isNaN(pointsToDeduct) || pointsToDeduct <= 0) {
        return message.reply('❌ O valor de pontos deve ser um número positivo.');
    }

    const tournament = await TournamentModel.findOne({
        guildId: message.guild!.id,
        name:    new RegExp(`^${escapeRegex(tourneyName)}$`, 'i'),
    });
    if (!tournament) return message.reply(`❌ Torneio **${tourneyName}** não encontrado.`);

    const standing = findEnrolledTeam(tournament, teamName);
    if (!standing) return message.reply(`❌ O time **${teamName}** não está inscrito em **${tourneyName}**.`);

    standing.points = Math.max(0, standing.points - pointsToDeduct);
    tournament.markModified('standings');
    await tournament.save();

    return message.reply(
        `⚖️ **STJD DELIBERA:** O clube **${standing.teamName}** é punido com a perda de **${pointsToDeduct} ponto(s)** ` +
        `no torneio **${tournament.name}**. Atual: **${standing.points}pts**.`,
    );
}

// ─── rp!futebol admin ban "Torneio" "Time" ───────────────────────────────────
export async function handleBan(message: Message, args: string[]) {
    if (!requireAdmin(message)) return message.reply('❌ Apenas administradores podem banir times.');

    const cleanArgs = extractArgs(message.content, 'admin ban');
    if (cleanArgs.length < 2) {
        return message.reply('⚠️ **Uso:** `rp!futebol admin ban "Torneio" "Time"`');
    }

    const tourneyName = cleanArgs[0];
    const teamName    = cleanArgs[1];

    const tournament = await TournamentModel.findOne({
        guildId: message.guild!.id,
        name:    new RegExp(`^${escapeRegex(tourneyName)}$`, 'i'),
    });
    if (!tournament) return message.reply(`❌ Torneio **${tourneyName}** não encontrado.`);

    const standing = findEnrolledTeam(tournament, teamName);
    if (!standing) return message.reply(`❌ O time **${teamName}** não está inscrito em **${tourneyName}**.`);
    const teamId = standing.teamId;

    // Remove da lista de participantes
    tournament.teams = tournament.teams.filter(id => id !== teamId);

    // Decreta W.O. (0×3) para todos os jogos pendentes/adiados do time banido,
    // CREDITANDO os pontos e gols aos adversários na tabela.
    const pendingMatches = await TourneyMatchModel.find({
        tournamentId: tournament.id,
        status:       { $in: ['PENDING', 'POSTPONED'] },
        $or: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    });

    const standingsMap = new Map<string, IStanding>(tournament.standings.map(s => [s.teamId, s]));

    let wosApplied = 0;
    for (const match of pendingMatches) {
        const isHome     = match.homeTeamId === teamId;
        match.homeScore  = isHome ? 0 : 3;
        match.awayScore  = isHome ? 3 : 0;
        match.status     = 'FINISHED';
        await match.save();

        const oppId = isHome ? match.awayTeamId : match.homeTeamId;
        const opp   = standingsMap.get(oppId);
        if (opp) {
            // Só o adversário pontua: banido não acumula nada (tabela dele é zerada)
            opp.games++; opp.wins++; opp.points += 3; opp.goalsFor += 3;
        }
        wosApplied++;
    }

    // Zera a campanha do banido (fica na tabela como registro histórico)
    standing.points = 0; standing.wins = 0; standing.draws = 0; standing.losses = 0;
    standing.goalsFor = 0; standing.goalsAgainst = 0; standing.games = 0;

    tournament.markModified('standings');
    tournament.markModified('teams');
    await tournament.save();

    return message.reply(
        `⛔ **STJD INFORMA:** O clube **${standing.teamName}** foi **excluído** do torneio **${tournament.name}**.\n` +
        `📋 **${wosApplied}** jogo(s) pendente(s) convertido(s) em W.O. (0×3 e 3 pontos para o adversário).`,
    );
}

// ─── rp!futebol admin postpone "Torneio" "Time A" "Time B" ───────────────────
export async function handlePostpone(message: Message, args: string[]) {
    if (!requireAdmin(message)) return message.reply('❌ Apenas administradores podem adiar partidas.');

    const cleanArgs = extractArgs(message.content, 'admin postpone');
    if (cleanArgs.length < 3) {
        return message.reply('⚠️ **Uso:** `rp!futebol admin postpone "Torneio" "Time A" "Time B"`');
    }

    const match = await findTourneyMatch(message, cleanArgs[0], cleanArgs[1], cleanArgs[2], 'PENDING');
    if (typeof match === 'string') return message.reply(match);

    match.doc.status = 'POSTPONED';
    await match.doc.save();

    return message.reply(
        `🛑 **PARTIDA ADIADA:** **${match.homeName}** × **${match.awayName}** ` +
        `(Rodada ${match.doc.round} de **${match.tournament.name}**) foi marcada como adiada.\n` +
        `-# Para remarcar: \`rp!futebol admin resume "${match.tournament.name}" "${match.homeName}" "${match.awayName}"\``,
    );
}

// ─── rp!futebol admin resume "Torneio" "Time A" "Time B" ─────────────────────
// Remarca um jogo adiado: volta para PENDING e o próximo `round sim` o disputa
// (mesmo que a rodada dele já tenha passado).
export async function handleResume(message: Message, args: string[]) {
    if (!requireAdmin(message)) return message.reply('❌ Apenas administradores podem remarcar partidas.');

    const cleanArgs = extractArgs(message.content, 'admin resume');
    if (cleanArgs.length < 3) {
        return message.reply('⚠️ **Uso:** `rp!futebol admin resume "Torneio" "Time A" "Time B"`');
    }

    const match = await findTourneyMatch(message, cleanArgs[0], cleanArgs[1], cleanArgs[2], 'POSTPONED');
    if (typeof match === 'string') return message.reply(match);

    match.doc.status = 'PENDING';
    await match.doc.save();

    return message.reply(
        `✅ **PARTIDA REMARCADA:** **${match.homeName}** × **${match.awayName}** volta à programação ` +
        `(Rodada ${match.doc.round}). Use \`rp!futebol round sim "${match.tournament.name}"\` para disputá-la.`,
    );
}

// ─── Helper: localiza um confronto do torneio pelos nomes dos times ───────────
async function findTourneyMatch(
    message: Message,
    tourneyName: string,
    homeTeamName: string,
    awayTeamName: string,
    status: 'PENDING' | 'POSTPONED',
): Promise<{ doc: any; tournament: ITournament; homeName: string; awayName: string } | string> {
    const tournament = await TournamentModel.findOne({
        guildId: message.guild!.id,
        name:    new RegExp(`^${escapeRegex(tourneyName)}$`, 'i'),
    });
    if (!tournament) return `❌ Torneio **${tourneyName}** não encontrado.`;

    const home = findEnrolledTeam(tournament, homeTeamName);
    const away = findEnrolledTeam(tournament, awayTeamName);
    if (!home || !away) return '❌ Um ou ambos os times não estão inscritos neste torneio.';

    // Aceita o confronto em qualquer ordem de mando
    const doc = await TourneyMatchModel.findOne({
        tournamentId: tournament.id,
        status,
        $or: [
            { homeTeamId: home.teamId, awayTeamId: away.teamId },
            { homeTeamId: away.teamId, awayTeamId: home.teamId },
        ],
    }).sort({ round: 1 });

    if (!doc) {
        const statusPt = status === 'PENDING' ? 'pendente' : 'adiado';
        return `❌ Não foi encontrado um confronto ${statusPt} entre **${home.teamName}** e **${away.teamName}** em **${tournament.name}**.`;
    }

    const homeName = doc.homeTeamId === home.teamId ? home.teamName : away.teamName;
    const awayName = doc.homeTeamId === home.teamId ? away.teamName : home.teamName;
    return { doc, tournament, homeName, awayName };
}
