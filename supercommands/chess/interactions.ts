// RPTool/supercommands/chess/interactions.ts
// ─── Roteador de interações do Xadrez ─────────────────────────────────────────
// Roteado pelo interaction_checkout via prefixo `chess_`. Stateless por customId:
//   chess_accept:<challengeId>   chess_decline:<challengeId>
//   chess_diff:<level>:<uid>     chess_move:<gameId>
//   chess_movemod:<gameId>       chess_fen:<gameId>     chess_resign:<gameId>
import {
    ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} from 'discord.js';
import { Chess } from 'chess.js';
import {
    games, challenges, genId, isChallengeExpired, buildGamePayload,
    ChessGame, BOT,
} from './index';
import { applyUserMove } from './parse';
import { engine, Difficulty } from './engine';

const ephemeral = (interaction: any, content: string) =>
    interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});

// userId de quem deve mover agora ('bot' se for a engine).
function whoseTurn(game: ChessGame): string {
    return new Chess(game.fen).turn() === 'w' ? game.white : game.black;
}

// Avaliação em peões (ótica das brancas) a partir do texto da engine, ou null
// quando é mate/desconhecido — usado pra decidir se o bot aceita empate.
function evalToPawns(evalStr: string | null): number | null {
    if (!evalStr) return null;
    const m = evalStr.match(/^([+-]?\d+(?:\.\d+)?)$/);
    return m ? parseFloat(m[1]) : null;
}

// Encerra a partida com uma mensagem custom (empate por acordo), sem botões.
async function endWithMessage(game: ChessGame, description: string, color = 0x95a5a6) {
    const payload = await buildGamePayload(game);
    payload.embeds[0].setDescription(description).setColor(color);
    return { embeds: payload.embeds, components: [], files: payload.files, attachments: [] };
}

// Aplica o lance da engine e atualiza o estado da partida.
async function playEngineMove(game: ChessGame) {
    const reply = await engine.bestMove(game.fen, game.difficulty);
    if (!reply.move) return;
    const chess = new Chess(game.fen);
    const m = chess.move({ from: reply.move.slice(0, 2), to: reply.move.slice(2, 4), promotion: reply.move[4] });
    if (!m) return;
    game.fen = chess.fen();
    game.history.push(m.san);
    game.lastMoveUci = m.from + m.to + (m.promotion ?? '');
    if (reply.eval) game.lastEval = reply.eval;
}

export async function handleChessInteraction(interaction: any): Promise<void> {
    const parts: string[] = interaction.customId.split(':');
    const action = parts[0];

    try {
        // ════ Convite: ACEITAR ════════════════════════════════════════════════
        if (action === 'chess_accept') {
            const challenge = challenges.get(parts[1]);
            if (!challenge || isChallengeExpired(challenge)) {
                challenges.delete(parts[1]);
                return void await interaction.update({ content: '⌛ Este convite expirou.', embeds: [], components: [] }).catch(() => {});
            }
            if (interaction.user.id !== challenge.opponentId) {
                return void ephemeral(interaction, '🔒 Esse convite não é pra você.');
            }
            challenges.delete(challenge.id);

            // Quem desafiou joga de PRETAS; o desafiado abre com as BRANCAS.
            const game: ChessGame = {
                id: genId(),
                channelId: challenge.channelId,
                white: challenge.opponentId,
                black: challenge.challengerId,
                vsBot: false,
                difficulty: 'medium',
                fen: new Chess().fen(),
                history: [],
                createdAt: Date.now(),
            };
            games.set(game.id, game);
            return void await interaction.update({ content: null, ...(await buildGamePayload(game)) });
        }

        // ════ Convite: RECUSAR ════════════════════════════════════════════════
        if (action === 'chess_decline') {
            const challenge = challenges.get(parts[1]);
            if (challenge && interaction.user.id !== challenge.opponentId && interaction.user.id !== challenge.challengerId) {
                return void ephemeral(interaction, '🔒 Esse convite não é seu.');
            }
            challenges.delete(parts[1]);
            return void await interaction.update({ content: '❌ Desafio recusado.', embeds: [], components: [] }).catch(() => {});
        }

        // ════ Escolha de dificuldade (vs Stockfish) ═══════════════════════════
        if (action === 'chess_diff') {
            const level = parts[1] as Difficulty;
            const uid = parts[2];
            if (interaction.user.id !== uid) return void ephemeral(interaction, '🔒 Esse menu não é seu.');

            const game: ChessGame = {
                id: genId(),
                channelId: interaction.channelId,
                white: uid,      // jogador abre com as brancas
                black: BOT,
                vsBot: true,
                difficulty: level,
                fen: new Chess().fen(),
                history: [],
                createdAt: Date.now(),
            };
            games.set(game.id, game);
            return void await interaction.update(await buildGamePayload(game));
        }

        // A partir daqui, todas as ações precisam de uma partida ativa.
        const game = games.get(parts[1]);

        // ════ FEN ═════════════════════════════════════════════════════════════
        if (action === 'chess_fen') {
            if (!game) return void ephemeral(interaction, '⚠️ Partida não encontrada (pode ter expirado).');
            return void ephemeral(interaction, `\`${game.fen}\``);
        }

        // ════ DESISTIR ════════════════════════════════════════════════════════
        if (action === 'chess_resign') {
            if (!game) return void await interaction.update({ components: [] }).catch(() => {});
            if (interaction.user.id !== game.white && interaction.user.id !== game.black) {
                return void ephemeral(interaction, '🔒 Você não está nesta partida.');
            }
            const winner = interaction.user.id === game.white ? game.black : game.white;
            const winnerLabel = winner === BOT ? '🤖 Stockfish' : `<@${winner}>`;
            games.delete(game.id);
            const payload = await buildGamePayload(game);
            payload.embeds[0].setDescription(`🏳️ <@${interaction.user.id}> desistiu. Vitória de ${winnerLabel}.`).setColor(0xe74c3c);
            return void await interaction.update({ embeds: payload.embeds, components: [], files: payload.files, attachments: [] });
        }

        // ════ PROPOR EMPATE ═══════════════════════════════════════════════════
        if (action === 'chess_draw') {
            if (!game) return void ephemeral(interaction, '⚠️ Partida não encontrada (pode ter expirado).');
            if (interaction.user.id !== game.white && interaction.user.id !== game.black) {
                return void ephemeral(interaction, '🔒 Você não está nesta partida.');
            }

            // vs Stockfish: a engine avalia e aceita só se a posição estiver equilibrada.
            if (game.vsBot) {
                await interaction.deferUpdate(); // avaliar pode passar de 3s; reconhece já
                const reply = await engine.bestMove(game.fen, game.difficulty);
                const pawns = evalToPawns(reply.eval);
                if (pawns !== null && Math.abs(pawns) <= 0.5) {
                    games.delete(game.id);
                    return void await interaction.editReply(await endWithMessage(game, '🤝 **Empate por acordo.** O Stockfish topou.')).catch(() => {});
                }
                return void await interaction.followUp({ content: '🤖 O Stockfish recusou o empate — ainda acha que dá jogo.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            // PvP: registra a proposta e mostra os botões de resposta pro oponente.
            if (game.drawOfferedBy) return void ephemeral(interaction, '⏳ Já existe uma proposta de empate pendente.');
            game.drawOfferedBy = interaction.user.id;
            return void await interaction.update(await buildGamePayload(game));
        }

        // ════ ACEITAR EMPATE (PvP) ════════════════════════════════════════════
        if (action === 'chess_drawyes') {
            if (!game) return void await interaction.update({ components: [] }).catch(() => {});
            const offererId = parts[2];
            const isPlayer = interaction.user.id === game.white || interaction.user.id === game.black;
            if (!isPlayer) return void ephemeral(interaction, '🔒 Você não está nesta partida.');
            if (interaction.user.id === offererId) return void ephemeral(interaction, '🤝 Você que propôs — espere o oponente responder.');
            games.delete(game.id);
            return void await interaction.update(await endWithMessage(game, `🤝 **Empate por acordo** entre <@${game.white}> e <@${game.black}>.`));
        }

        // ════ RECUSAR EMPATE (PvP) ════════════════════════════════════════════
        if (action === 'chess_drawno') {
            if (!game) return void await interaction.update({ components: [] }).catch(() => {});
            const offererId = parts[2];
            const isPlayer = interaction.user.id === game.white || interaction.user.id === game.black;
            if (!isPlayer) return void ephemeral(interaction, '🔒 Você não está nesta partida.');
            if (interaction.user.id === offererId) return void ephemeral(interaction, '🤝 Você que propôs — espere o oponente responder.');
            game.drawOfferedBy = undefined;
            return void await interaction.update(await buildGamePayload(game, { note: `❌ <@${interaction.user.id}> recusou o empate. O jogo continua.` }));
        }

        // ════ Abrir modal de lance ════════════════════════════════════════════
        if (action === 'chess_move') {
            if (!game) return void ephemeral(interaction, '⚠️ Partida não encontrada (pode ter expirado).');
            const turnId = whoseTurn(game);
            if (interaction.user.id !== game.white && interaction.user.id !== game.black) {
                return void ephemeral(interaction, '🔒 Você não está nesta partida.');
            }
            if (interaction.user.id !== turnId) {
                return void ephemeral(interaction, '⏳ Não é a sua vez.');
            }
            const modal = new ModalBuilder().setCustomId(`chess_movemod:${game.id}`).setTitle('Seu lance');
            const input = new TextInputBuilder()
                .setCustomId('lance')
                .setLabel('Lance (e4, Nf3, De4, e2e4, Qxd4, O-O…)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(10);
            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
            return void await interaction.showModal(modal);
        }

        // ════ Modal submetido: aplica o lance ═════════════════════════════════
        if (action === 'chess_movemod') {
            if (!game) return void ephemeral(interaction, '⚠️ Partida não encontrada (pode ter expirado).');
            const turnId = whoseTurn(game);
            if (interaction.user.id !== turnId) {
                return void ephemeral(interaction, '⏳ Não é a sua vez.');
            }

            const raw = interaction.fields.getTextInputValue('lance');
            const chess = new Chess(game.fen);
            const move = applyUserMove(chess, raw);
            if (!move) {
                return void ephemeral(interaction, `❌ Lance **${raw}** inválido ou impossível nesta posição.`);
            }

            game.fen = chess.fen();
            game.history.push(move.san);
            game.lastMoveUci = move.from + move.to + (move.promotion ?? '');
            game.drawOfferedBy = undefined; // jogar recusa qualquer empate pendente

            // Acabou no lance do jogador?
            if (chess.isGameOver()) {
                games.delete(game.id);
                return void await interaction.update(await buildGamePayload(game));
            }

            // vs Stockfish: mostra "pensando", calcula e depois edita com a resposta.
            if (game.vsBot && whoseTurn(game) === BOT) {
                await interaction.update(await buildGamePayload(game, { thinking: true }));
                await playEngineMove(game);
                const over = new Chess(game.fen).isGameOver();
                if (over) games.delete(game.id);
                return void await interaction.message.edit(await buildGamePayload(game)).catch(() => {});
            }

            // PvP: passa a vez pro outro jogador.
            return void await interaction.update(await buildGamePayload(game));
        }
    } catch (e) {
        console.error('[Xadrez] Erro na interação:', e);
        if (interaction.isRepliable?.() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '🚨 Erro ao processar a jogada.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
}
