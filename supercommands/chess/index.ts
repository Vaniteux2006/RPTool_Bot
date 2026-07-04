// RPTool/supercommands/chess/index.ts
// ─── Xadrez (PvP + Stockfish) ─────────────────────────────────────────────────
//
// Dois modos:
//   • PvP  — `rp!chess @oponente` manda um convite; ao aceitar, a partida começa
//            com QUEM DESAFIOU jogando de PRETAS (o desafiado abre com as brancas).
//   • Bot  — `rp!chess bot` deixa escolher a dificuldade e jogar contra a engine.
//
// O lance é digitado num modal (botão "Fazer Lance") e aceita várias notações
// (e4, Nf3, De4, e2e4, Qxd4, Qe4+ …) — ver parse.ts. Os cliques (customId `chess_…`)
// são roteados pelo interactionCheckout → interactions.ts. Estado em memória
// (partidas efêmeras, sem DB), no padrão do antigo global.chessSessions.
import {
    Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,
} from 'discord.js';
import { Chess } from 'chess.js';
import { Difficulty, DIFFICULTY } from './engine';
import { ChessGameModel } from '../../tools/models/ChessSchema';

// ─── Estado em memória ────────────────────────────────────────────────────────
export interface ChessGame {
    id: string;
    channelId: string;
    white: string;          // userId, ou 'bot'
    black: string;          // userId, ou 'bot'
    vsBot: boolean;
    difficulty: Difficulty; // só importa quando vsBot
    fen: string;
    history: string[];      // lances em SAN
    lastMoveUci?: string;   // ex: e2e4 — para destacar no tabuleiro
    lastEval?: string;      // última avaliação da engine (só vsBot)
    drawOfferedBy?: string; // userId de quem propôs empate (proposta pendente)
    createdAt: number;
}

export interface ChessChallenge {
    id: string;
    channelId: string;
    challengerId: string;   // joga de PRETAS
    opponentId: string;     // joga de BRANCAS (abre o jogo)
    createdAt: number;
}

// Desafios (convites) ficam em memória: são efêmeros (10 min) e de baixo risco —
// se um restart os perder, é só desafiar de novo. As PARTIDAS, porém, vivem no
// Mongo (ver getGame/saveGame) pra sobreviver a restart e expirar por TTL de 1h.
export const challenges = new Map<string, ChessChallenge>();

export const BOT = 'bot';
const CHALLENGE_TTL = 10 * 60 * 1000; // convite expira em 10 min

export function genId(): string {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// Varre convites velhos de tempos em tempos (partidas são limpas pelo TTL do Mongo).
const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [id, c] of challenges) if (now - c.createdAt > CHALLENGE_TTL) challenges.delete(id);
}, 5 * 60 * 1000);
sweeper.unref();

// ─── Persistência das partidas (MongoDB) ──────────────────────────────────────
const docToGame = (d: any): ChessGame => ({
    id: d.gameId,
    channelId: d.channelId,
    white: d.white,
    black: d.black,
    vsBot: d.vsBot,
    difficulty: d.difficulty,
    fen: d.fen,
    history: d.history ?? [],
    lastMoveUci: d.lastMoveUci ?? undefined,
    lastEval: d.lastEval ?? undefined,
    drawOfferedBy: d.drawOfferedBy ?? undefined,
    createdAt: d.createdAt,
});

export async function getGame(id: string): Promise<ChessGame | null> {
    const doc = await ChessGameModel.findOne({ gameId: id }).lean().catch(() => null);
    return doc ? docToGame(doc) : null;
}

// Upsert + reinício do relógio TTL (updatedAt = agora) a cada jogada.
export async function saveGame(game: ChessGame): Promise<void> {
    await ChessGameModel.updateOne(
        { gameId: game.id },
        {
            $set: {
                gameId: game.id,
                channelId: game.channelId,
                white: game.white,
                black: game.black,
                vsBot: game.vsBot,
                difficulty: game.difficulty,
                fen: game.fen,
                history: game.history,
                lastMoveUci: game.lastMoveUci ?? null,
                lastEval: game.lastEval ?? null,
                drawOfferedBy: game.drawOfferedBy ?? null,
                createdAt: game.createdAt,
                updatedAt: new Date(),
            },
        },
        { upsert: true },
    ).catch((e) => console.error('[Xadrez] Falha ao salvar partida:', e));
}

export async function deleteGame(id: string): Promise<void> {
    await ChessGameModel.deleteOne({ gameId: id }).catch(() => {});
}

// ─── Helpers de exibição ──────────────────────────────────────────────────────
export function isChallengeExpired(c: ChessChallenge): boolean {
    return Date.now() - c.createdAt > CHALLENGE_TTL;
}

function playerLabel(game: ChessGame, color: 'w' | 'b'): string {
    const id = color === 'w' ? game.white : game.black;
    if (id === BOT) return `🤖 Stockfish (${DIFFICULTY[game.difficulty].label})`;
    return `<@${id}>`;
}

// URL do tabuleiro no web-boardimage (serviço open-source do lichess → PNG).
function boardImageUrl(fen: string, opts: { lastMove?: string; check?: string } = {}): string {
    const params = new URLSearchParams({ fen, coordinates: 'true', size: '480' });
    if (opts.lastMove) params.set('lastMove', opts.lastMove);
    if (opts.check) params.set('check', opts.check);
    return `https://backscattering.de/web-boardimage/board.png?${params.toString()}`;
}

// Baixa o PNG do tabuleiro e devolve como ANEXO. Anexar o arquivo (em vez de só
// apontar uma URL) é o que faz a imagem aparecer: o proxy de imagens do Discord
// não consegue buscar serviços externos de xadrez, mas anexos são hospedados
// direto pelo Discord, sem proxy no meio. O bot consegue baixar (rede normal).
async function boardAttachment(fen: string, opts: { lastMove?: string; check?: string } = {}): Promise<AttachmentBuilder | null> {
    try {
        const res = await fetch(boardImageUrl(fen, opts));
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return new AttachmentBuilder(buf, { name: 'board.png' });
    } catch (e) {
        console.warn('[Xadrez] Falha ao baixar o tabuleiro:', e);
        return null;
    }
}

// Casa do rei de uma cor — usada pra destacar o rei em xeque na imagem.
function kingSquare(chess: Chess, color: 'w' | 'b'): string | undefined {
    for (const row of chess.board()) {
        for (const sq of row) {
            if (sq && sq.type === 'k' && sq.color === color) return sq.square;
        }
    }
    return undefined;
}

// Histórico no formato "1. e4 e5  2. Nf3 Nc6 …" (limitado pro campo do embed).
function formatHistory(history: string[]): string {
    if (history.length === 0) return '_Nenhum lance ainda._';
    const lines: string[] = [];
    for (let i = 0; i < history.length; i += 2) {
        const n = i / 2 + 1;
        const white = history[i];
        const black = history[i + 1] ?? '';
        lines.push(`${n}. ${white} ${black}`.trim());
    }
    let text = lines.join('   ');
    if (text.length > 1000) text = '…' + text.slice(text.length - 1000); // mostra o final
    return text;
}

// ─── Montagem do payload da partida (embed + botões) ──────────────────────────
export async function buildGamePayload(game: ChessGame, opts: { thinking?: boolean; note?: string; evalText?: string } = {}) {
    const chess = new Chess(game.fen);
    const over = chess.isGameOver();
    const turn = chess.turn();
    const checkSquare = chess.isCheck() ? kingSquare(chess, turn) : undefined;

    const file = await boardAttachment(game.fen, { lastMove: game.lastMoveUci, check: checkSquare });

    const embed = new EmbedBuilder()
        .setColor(over ? 0xe74c3c : turn === 'w' ? 0xf0f0f0 : 0x2b2d31)
        .setTitle('♟️ Xadrez')
        .setImage(file ? 'attachment://board.png' : boardImageUrl(game.fen, { lastMove: game.lastMoveUci, check: checkSquare }))
        .addFields(
            { name: '⚪ Brancas', value: playerLabel(game, 'w'), inline: true },
            { name: '⚫ Pretas', value: playerLabel(game, 'b'), inline: true },
        );

    if (over) {
        let result: string;
        if (chess.isCheckmate()) {
            const winnerColor = turn === 'w' ? 'b' : 'w'; // quem deu o mate é o lado oposto ao que está pra mover
            result = `♚ **Xeque-mate!** Vitória das ${winnerColor === 'w' ? 'Brancas' : 'Pretas'} — ${playerLabel(game, winnerColor)}`;
        } else if (chess.isStalemate()) {
            result = '🤝 **Empate por afogamento (stalemate).**';
        } else if (chess.isInsufficientMaterial()) {
            result = '🤝 **Empate por material insuficiente.**';
        } else if (chess.isThreefoldRepetition()) {
            result = '🤝 **Empate por repetição.**';
        } else if (chess.isDraw()) {
            result = '🤝 **Empate.**';
        } else {
            result = '🏁 **Fim de jogo.**';
        }
        embed.setDescription(result);
    } else {
        const toMove = `Vez das **${turn === 'w' ? 'Brancas' : 'Pretas'}** — ${playerLabel(game, turn)}`;
        const check = chess.isCheck() ? '\n⚠️ **Xeque!**' : '';
        const thinking = opts.thinking ? '\n🤖 *Stockfish está pensando…*' : '';
        embed.setDescription(toMove + check + thinking);
    }

    embed.addFields({ name: '📜 Lances', value: formatHistory(game.history).slice(0, 1024), inline: false });
    if (game.vsBot) {
        const evalText = opts.evalText ?? game.lastEval;
        const evalPart = evalText ? ` • Avaliação: ${evalText}` : '';
        embed.setFooter({ text: `Modo: vs Stockfish • Dificuldade: ${DIFFICULTY[game.difficulty].label}${evalPart}` });
    }
    // Proposta de empate pendente (PvP): mostra quem propôs.
    if (!over && game.drawOfferedBy) {
        embed.addFields({ name: '🤝 Proposta de empate', value: `<@${game.drawOfferedBy}> propôs empate. O oponente decide abaixo (ou ignore e jogue normalmente).`, inline: false });
    }
    if (opts.note) embed.addFields({ name: '​', value: opts.note, inline: false });

    const components = over ? [] : [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`chess_move:${game.id}`).setLabel('Fazer Lance').setEmoji('♟️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`chess_draw:${game.id}`).setLabel('Empate').setEmoji('🤝').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`chess_fen:${game.id}`).setLabel('FEN').setEmoji('📋').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`chess_resign:${game.id}`).setLabel('Desistir').setEmoji('🏳️').setStyle(ButtonStyle.Danger),
        ),
    ];

    // Linha extra de resposta à proposta de empate (só PvP, oferta pendente).
    if (!over && game.drawOfferedBy) {
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`chess_drawyes:${game.id}:${game.drawOfferedBy}`).setLabel('Aceitar empate').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`chess_drawno:${game.id}:${game.drawOfferedBy}`).setLabel('Recusar empate').setEmoji('❌').setStyle(ButtonStyle.Danger),
        ));
    }

    // attachments: [] descarta anexos antigos da mensagem; files: [novo] põe o
    // tabuleiro atual. Sem isso, cada re-render empilharia um board.png a mais.
    return { embeds: [embed], components, files: file ? [file] : [], attachments: [] };
}

// ─── Tela de escolha de dificuldade (vs Stockfish) ────────────────────────────
function difficultyPayload(uid: string) {
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('🤖 Xadrez vs Stockfish')
        .setDescription('Escolha a dificuldade. Você joga com as **Brancas** e abre o jogo.');
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`chess_diff:easy:${uid}`).setLabel('Fácil').setEmoji('🟢').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`chess_diff:medium:${uid}`).setLabel('Médio').setEmoji('🟡').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`chess_diff:hard:${uid}`).setLabel('Difícil').setEmoji('🔴').setStyle(ButtonStyle.Danger),
    );
    return { embeds: [embed], components: [row] };
}

// ─── Convite PvP (embed + Aceitar/Recusar) ────────────────────────────────────
function challengePayload(challenge: ChessChallenge) {
    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('♟️ Desafio de Xadrez')
        .setDescription(
            `<@${challenge.opponentId}>, <@${challenge.challengerId}> te chamou pra jogar xadrez. Aceita?\n\n` +
            `Se aceitar, **você joga de Brancas** (abre o jogo) e <@${challenge.challengerId}> joga de Pretas.`,
        );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`chess_accept:${challenge.id}`).setLabel('Aceitar').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`chess_decline:${challenge.id}`).setLabel('Recusar').setEmoji('❌').setStyle(ButtonStyle.Danger),
    );
    return { embeds: [embed], components: [row] };
}

const HELP =
    '**♟️ Xadrez**\n' +
    '`rp!chess @oponente` — Desafia alguém (quem desafia joga de pretas).\n' +
    '`rp!chess bot` — Joga contra o Stockfish (escolhe a dificuldade).\n\n' +
    'O lance é digitado no botão **Fazer Lance** e aceita várias notações: `e4`, `Nf3`, `De4` (português), `e2e4` (bruto), `Qxd4`, `Qe4+`, `O-O`.';

// ─── Entrada do comando (prefixo) ─────────────────────────────────────────────
export default {
    name: 'chess',
    description: 'Jogue Xadrez contra outro membro ou contra o Stockfish.',
    aliases: ['xadrez'],

    async execute(message: Message, args: string[]) {
        const sub = (args[0] || '').toLowerCase();

        // ── vs Stockfish ──
        if (['bot', 'ia', 'cpu', 'stockfish', 'engine'].includes(sub)) {
            return message.reply(difficultyPayload(message.author.id));
        }

        // ── Desafio PvP (mencionou alguém) ──
        const opponent = message.mentions?.users?.find(u => u.id !== message.author.id);
        if (opponent) {
            if (opponent.bot) {
                return message.reply('🤖 Pra jogar contra o bot use `rp!chess bot`.');
            }
            const challenge: ChessChallenge = {
                id: genId(),
                channelId: message.channelId,
                challengerId: message.author.id,
                opponentId: opponent.id,
                createdAt: Date.now(),
            };
            challenges.set(challenge.id, challenge);
            return message.reply({ content: `<@${opponent.id}>`, ...challengePayload(challenge) });
        }

        // ── Ajuda ──
        return message.reply(HELP);
    },
};

export { challengePayload, difficultyPayload };
