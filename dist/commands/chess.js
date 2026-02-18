"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const chess_js_1 = require("chess.js");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class ChessBot {
    process = null;
    constructor() {
        this.initEngine();
    }
    initEngine() {
        const isWin = process.platform === 'win32';
        const binName = isWin ? 'stockfish.exe' : 'stockfish';
        const binPath = path_1.default.join(process.cwd(), binName);
        if (!fs_1.default.existsSync(binPath)) {
            console.error(`❌ [XADREZ] Executável não encontrado em: ${binPath}`);
            return;
        }
        try {
            this.process = (0, child_process_1.spawn)(binPath);
            this.process.on('error', (err) => console.error("❌ [XADREZ] Erro na engine:", err));
            this.send("uci");
            this.send("isready");
            this.send("setoption name Skill Level value 5");
            console.log(`♟️ [XADREZ] Engine nativa iniciada (${binName})`);
        }
        catch (e) {
            console.error("❌ [XADREZ] Falha ao iniciar:", e);
        }
    }
    send(command) {
        if (this.process && this.process.stdin && !this.process.killed) {
            this.process.stdin.write(command + '\n');
        }
    }
    async getBestMove(fen, depth = 10) {
        if (!this.process || !this.process.stdout)
            return { move: null, eval: null };
        return new Promise((resolve) => {
            const proc = this.process;
            let lastEval = null;
            const turn = fen.split(' ')[1];
            const listener = (data) => {
                const lines = data.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('info') && line.includes('score')) {
                        const parts = line.split(' ');
                        const scoreIndex = parts.indexOf('score');
                        const type = parts[scoreIndex + 1];
                        const value = parseInt(parts[scoreIndex + 2]);
                        if (type === 'cp') {
                            const standardScore = (value * (turn === 'b' ? -1 : 1)) / 100;
                            lastEval = (standardScore > 0 ? '+' : '') + standardScore.toFixed(2);
                        }
                        else if (type === 'mate') {
                            const mateIn = value * (turn === 'b' ? -1 : 1);
                            lastEval = `Mate em ${Math.abs(mateIn)} (${mateIn > 0 ? 'Brancas' : 'Pretas'})`;
                        }
                    }
                    if (line.startsWith('bestmove')) {
                        const parts = line.split(' ');
                        const move = parts[1];
                        proc.stdout?.off('data', listener);
                        resolve({
                            move: move === '(none)' ? null : move,
                            eval: lastEval
                        });
                    }
                }
            };
            proc.stdout.on('data', listener);
            this.send(`position fen ${fen}`);
            this.send(`go depth ${depth}`);
        });
    }
    async play_turn(fen, user_move_san) {
        const chess = new chess_js_1.Chess(fen);
        let move;
        try {
            move = chess.move(user_move_san);
            if (!move)
                throw new Error("Lance ilegal");
        }
        catch (e) {
            const moveName = typeof user_move_san === 'string'
                ? user_move_san
                : `${user_move_san.from}${user_move_san.to}`;
            return { fen: fen, error: `Movimento **${moveName}** inválido ou impossível.` };
        }
        // Se chegou aqui, o lance foi válido
        if (chess.isGameOver()) {
            return {
                fen: chess.fen(),
                game_over: true,
                result: this.getResult(chess),
                player_move: move.san
            };
        }
        const engineData = await this.getBestMove(chess.fen());
        if (engineData.move) {
            const botMove = chess.move(engineData.move);
            return {
                fen: chess.fen(),
                bot_move: botMove.san,
                game_over: chess.isGameOver(),
                result: chess.isGameOver() ? this.getResult(chess) : undefined,
                player_move: move.san,
                evaluation: engineData.eval || "0.00"
            };
        }
        else {
            return { fen: chess.fen(), error: "Engine morreu ou não respondeu." };
        }
    }
    getResult(chess) {
        if (chess.isCheckmate())
            return "Xeque-mate! 🏆";
        if (chess.isDraw())
            return "Empate";
        return "Fim de Jogo";
    }
}
const chessBot = new ChessBot();
exports.default = {
    name: 'chess',
    description: 'Jogue Xadrez contra o Stockfish',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('chess')
        .setDescription('Jogue Xadrez')
        .addSubcommand(sub => sub.setName('start').setDescription('Novo jogo'))
        .addSubcommand(sub => sub.setName('move')
        .setDescription('Faz um lance')
        .addStringOption(op => op.setName('lance').setDescription('Ex: e4').setRequired(true))),
    async executeSlash(interaction) {
        const sub = interaction.options.getSubcommand();
        const args = [sub];
        if (sub === 'move')
            args.push(interaction.options.getString('lance') || '');
        await interaction.deferReply();
        const fakeMsg = {
            author: interaction.user,
            reply: async (c) => interaction.editReply(c)
        };
        await this.execute(fakeMsg, args);
    },
    async execute(message, args) {
        const userId = message.author.id;
        const originalArg0 = args[0] || '';
        let action = originalArg0.toLowerCase() || 'help';
        let move = args[1];
        const commands = ['start', 'new', 'fen', 'help'];
        if (action === 'play' && move) {
            action = 'move';
        }
        else if (!commands.includes(action) && action.length >= 2) {
            move = originalArg0;
            action = 'move';
        }
        if (!global.chessSessions)
            global.chessSessions = {};
        let session = global.chessSessions[userId];
        // --- START ---
        if (action === 'start' || action === 'new') {
            session = { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', history: [] };
            global.chessSessions[userId] = session;
            const boardUrl = `https://lichess1.org/export/fen.gif?fen=${encodeURIComponent(session.fen)}&theme=green&piece=cburnett`;
            const embed = new discord_js_1.EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('♟️ Novo Jogo Iniciado')
                .setDescription('Você joga com as **Brancas**.\nUse `rp!chess <lance>` para jogar (Ex: `rp!chess e4` ou `Nf3`).')
                .setImage(boardUrl)
                .setFooter({ text: 'Avaliação: +0.20 • Engine: Stockfish 17' });
            return message.reply({ embeds: [embed] });
        }
        if (action === 'move') {
            if (!session)
                return message.reply("⚠️ Sem jogo ativo. Use `rp!chess start`.");
            if (!move)
                return message.reply("⚠️ Digite o lance. Ex: `rp!chess e4`");
            // Tradução PT -> EN e Correções
            let sanitizedMove = move
                .replace(/^C/i, 'N') // Cavalo
                .replace(/^T/i, 'R') // Torre
                .replace(/^D/i, 'Q') // Dama
                .replace(/^B/i, 'B') // Bispo
                .replace(/^R/i, 'K'); // Rei
            let result = await chessBot.play_turn(session.fen, sanitizedMove);
            if (result.error) {
                if (move.match(/^[a-h][1-8][a-h][1-8]$/)) {
                    const from = move.substring(0, 2);
                    const to = move.substring(2, 4);
                    const uciResult = await chessBot.play_turn(session.fen, { from, to });
                    if (!uciResult.error) {
                        result = uciResult;
                    }
                    else {
                        return message.reply(`❌ ${result.error}`);
                    }
                }
                else {
                    return message.reply(`❌ ${result.error}`);
                }
            }
            session.fen = result.fen;
            const boardUrl = `https://lichess1.org/export/fen.gif?fen=${encodeURIComponent(result.fen)}&theme=green&piece=cburnett`;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(result.game_over ? `🏁 Fim de Jogo: ${result.result}` : '♟️ Partida em Andamento')
                .setColor(result.game_over ? '#e74c3c' : '#2ecc71')
                .addFields({ name: '👤 Você jogou:', value: `**${result.player_move}**`, inline: true }, { name: '💻 Stockfish respondeu:', value: `**${result.bot_move || '...'}**`, inline: true })
                .setImage(boardUrl)
                .setFooter({ text: `Avaliação: ${result.evaluation || 'Calculando...'} • Stockfish 17` });
            if (result.game_over)
                delete global.chessSessions[userId];
            return message.reply({ embeds: [embed] });
        }
        if (action === 'fen')
            return message.reply(session ? `\`${session.fen}\`` : "Nada rolando.");
        return message.reply("**Xadrez:**\n`rp!chess start` - Começar\n`rp!chess e4` - Jogar");
    }
};
