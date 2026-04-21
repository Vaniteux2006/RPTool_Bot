import { Message, EmbedBuilder } from 'discord.js';
import { TournamentModel, TourneyMatchModel, TeamModel } from '../../../tools/models/FutebolSchema';
import { extractName } from '../../oc/utils';

export async function handleRoundView(message: Message, args: string[]) {
    const extracted = extractName(message.content, 'round view');
    if (!extracted) return message.reply("⚠️ Uso: `rp!futebol round view \"Nome do Torneio\"`");

    const tournament = await TournamentModel.findOne({ guildId: message.guild!.id, name: extracted.name });
    if (!tournament) return message.reply("❌ Torneio não encontrado.");

    const matches = await TourneyMatchModel.find({ tournamentId: tournament.id, round: tournament.currentRound });
    if (matches.length === 0) return message.reply(`📭 Nenhum jogo encontrado para a Rodada ${tournament.currentRound}.`);

    const lines: string[] = [];
    for (const match of matches) {
        const home = await TeamModel.findById(match.homeTeamId);
        const away = await TeamModel.findById(match.awayTeamId);
        
        if (!home || !away) continue;

        let statusIcon = "⏳";
        let score = "vs";
        if (match.status === 'FINISHED') { statusIcon = "✅"; score = `${match.homeScore} x ${match.awayScore}`; }
        if (match.status === 'POSTPONED') { statusIcon = "🛑"; score = "ADIADO"; }

        lines.push(`${statusIcon} **${home.name}** ${score} **${away.name}**`);
    }

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`📅 Confrontos: Rodada ${tournament.currentRound} - ${tournament.name}`)
        .setDescription(lines.join('\n\n'));

    return message.reply({ embeds: [embed] });
}