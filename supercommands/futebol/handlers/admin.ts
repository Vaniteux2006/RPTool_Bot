import { Message } from 'discord.js';
import { TournamentModel, TeamModel, TourneyMatchModel } from '../../../tools/models/FutebolSchema';
import { extractArgs } from '../../../tools/utils/textUtils';

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireAdmin(message: Message): boolean {
    const member = message.guild!.members.cache.get(message.author.id);
    return !!member?.permissions.has('ManageGuild');
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

    const team = await TeamModel.findOne({ name: new RegExp(`^${escapeRegex(teamName)}$`, 'i') });
    if (!team) return message.reply(`❌ Time **${teamName}** não encontrado.`);

    const standing = tournament.standings.find(s => s.teamId === team.id);
    if (!standing) return message.reply(`❌ O time **${teamName}** não está inscrito em **${tourneyName}**.`);

    standing.points = Math.max(0, standing.points - pointsToDeduct);
    tournament.markModified('standings');
    await tournament.save();

    return message.reply(
        `⚖️ **STJD DELIBERA:** O clube **${team.name}** é punido com a perda de **${pointsToDeduct} ponto(s)** ` +
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

    const team = await TeamModel.findOne({ name: new RegExp(`^${escapeRegex(teamName)}$`, 'i') });
    if (!team) return message.reply(`❌ Time **${teamName}** não encontrado.`);

    // Remove da lista de participantes e zera a tabela
    tournament.teams = tournament.teams.filter(id => id !== team.id);
    const standing = tournament.standings.find(s => s.teamId === team.id);
    if (standing) {
        standing.points       = 0;
        standing.wins         = 0;
        standing.draws        = 0;
        standing.losses       = 0;
        standing.goalsFor     = 0;
        standing.goalsAgainst = 0;
    }

    // Decreta W.O. (0×3) para todos os jogos pendentes do time banido
    const pendingMatches = await TourneyMatchModel.find({
        tournamentId: tournament.id,
        status:       'PENDING',
        $or: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
    });

    let wosApplied = 0;
    for (const match of pendingMatches) {
        const isHome     = match.homeTeamId === team.id;
        match.homeScore  = isHome ? 0 : 3;
        match.awayScore  = isHome ? 3 : 0;
        match.status     = 'FINISHED';
        await match.save();
        wosApplied++;
    }

    tournament.markModified('standings');
    tournament.markModified('teams');
    await tournament.save();

    return message.reply(
        `⛔ **STJD INFORMA:** O clube **${team.name}** foi **excluído** do torneio **${tournament.name}**.\n` +
        `📋 **${wosApplied}** jogo(s) pendente(s) convertido(s) em W.O. (0×3 para o adversário).`,
    );
}

// ─── rp!futebol admin postpone "Torneio" "Time A" "Time B" ───────────────────
export async function handlePostpone(message: Message, args: string[]) {
    if (!requireAdmin(message)) return message.reply('❌ Apenas administradores podem adiar partidas.');

    const cleanArgs = extractArgs(message.content, 'admin postpone');
    if (cleanArgs.length < 3) {
        return message.reply('⚠️ **Uso:** `rp!futebol admin postpone "Torneio" "Time A" "Time B"`');
    }

    const tourneyName = cleanArgs[0];
    const homeTeamName = cleanArgs[1];
    const awayTeamName = cleanArgs[2];

    const tournament = await TournamentModel.findOne({
        guildId: message.guild!.id,
        name:    new RegExp(`^${escapeRegex(tourneyName)}$`, 'i'),
    });
    if (!tournament) return message.reply(`❌ Torneio **${tourneyName}** não encontrado.`);

    const homeTeam = await TeamModel.findOne({ name: new RegExp(`^${escapeRegex(homeTeamName)}$`, 'i') });
    const awayTeam = await TeamModel.findOne({ name: new RegExp(`^${escapeRegex(awayTeamName)}$`, 'i') });

    if (!homeTeam || !awayTeam) return message.reply('❌ Um ou ambos os times não foram encontrados.');

    const match = await TourneyMatchModel.findOne({
        tournamentId: tournament.id,
        round:        tournament.currentRound,
        homeTeamId:   homeTeam.id,
        awayTeamId:   awayTeam.id,
        status:       'PENDING',
    });

    if (!match) {
        return message.reply(
            `❌ Não foi encontrado um confronto pendente entre **${homeTeamName}** e **${awayTeamName}** ` +
            `na Rodada **${tournament.currentRound}** de **${tournament.name}**.`,
        );
    }

    match.status = 'POSTPONED';
    await match.save();

    return message.reply(
        `🛑 **PARTIDA ADIADA:** **${homeTeam.name}** × **${awayTeam.name}** ` +
        `(Rodada ${tournament.currentRound} de **${tournament.name}**) foi marcada como adiada.`,
    );
}