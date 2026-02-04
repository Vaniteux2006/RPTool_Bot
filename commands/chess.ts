import { SlashCommandBuilder, ChatInputCommandInteraction, Message, EmbedBuilder } from 'discord.js';
import { Chess } from 'chess.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

// --- LÓGICA DO XADREZ (NATIVO COM EVAL) ---

interface ChessResult {
    fen: string;
    bot_move?: string;
    game_over?: boolean;
    result?: string;
    message?: string;
    error?: string;
    player_move?: string;
    evaluation?: string;
}

class ChessBot {
    private process: ChildProcess | null = null;

    constructor() {
        this.initEngine();
    }

    private initEngine() {
        const isWin = process.platform === 'win32';
        const binName = isWin ? 'stockfish.exe' : 'stockfish';
        const binPath = path.join(process.cwd(), 'bin', binName);

        if (!fs.existsSync(binPath)) {
            console.error(`❌ [XADREZ] Executável não encontrado em: ${binPath}`);
            return;
        }

        try {
            this.process = spawn(binPath);
            this.process.on('error', (err) => console.error("❌ [XADREZ] Erro na engine:", err));

            this.send("uci");
            this.send("isready");
            this.send("setoption name Skill Level value 5"); // Nível 5 (Equilibrado)
            
            console.log(`♟️ [XADREZ] Engine nativa iniciada (${binName})`);

        } catch (e) {
            console.error("❌ [XADREZ] Falha ao iniciar:", e);
        }
    }

    private send(command: string) {
        if (this.process && this.process.stdin && !this.process.killed) {
            this.process.stdin.write(command + '\n');
        }
    }

    private async getBestMove(fen: string, depth: number = 10): Promise<{ move: string | null, eval: string | null }> {
        if (!this.process || !this.process.stdout) return { move: null, eval: null };

        return new Promise((resolve) => {
            const proc = this.process!;
            let lastEval: string | null = null;
            
            const turn = fen.split(' ')[1]; // 'w' ou 'b'

            const listener = (data: Buffer) => {
                const lines = data.toString().split('\n');
                for (const line of lines) {
                    
                    // Captura a avaliação
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

                    // Captura o movimento final
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

    async play_turn(fen: string, user_move_san: string | { from: string, to: string }): Promise<ChessResult> {
        const chess = new Chess(fen);
        let move;

        try {
            // Tenta fazer o movimento
            move = chess.move(user_move_san);
            if (!move) throw new Error("Lance ilegal");
        } catch (e) {
            // Se der erro, formata o nome do movimento para exibir no erro
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
                player_move: move.san // Usa move.san (String) para corrigir o erro de tipo
            };
        }

        // Vez da Engine
        const engineData = await this.getBestMove(chess.fen());

        if (engineData.move) {
            const botMove = chess.move(engineData.move);
            return {
                fen: chess.fen(),
                bot_move: botMove.san,
                game_over: chess.isGameOver(),
                result: chess.isGameOver() ? this.getResult(chess) : undefined,
                player_move: move.san, // Usa move.san aqui também
                evaluation: engineData.eval || "0.00"
            };
        } else {
            return { fen: chess.fen(), error: "Engine morreu ou não respondeu." };
        }
    }

    private getResult(chess: Chess): string {
        if (chess.isCheckmate()) return "Xeque-mate! 🏆";
        if (chess.isDraw()) return "Empate";
        return "Fim de Jogo";
    }
}

const chessBot = new ChessBot();

// --- COMANDO DISCORD ---

export default {
    name: 'chess',
    description: 'Jogue Xadrez contra o Stockfish',
    
    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Jogue Xadrez')
        .addSubcommand(sub => sub.setName('start').setDescription('Novo jogo'))
        .addSubcommand(sub => 
            sub.setName('move')
                .setDescription('Faz um lance')
                .addStringOption(op => op.setName('lance').setDescription('Ex: e4').setRequired(true))),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const args = [sub];
        if (sub === 'move') args.push(interaction.options.getString('lance') || '');
        
        await interaction.deferReply();
        
        const fakeMsg: any = {
            author: interaction.user,
            reply: async (c: any) => interaction.editReply(c)
        };
        await this.execute(fakeMsg, args);
    },

    async execute(message: Message | any, args: string[]) {
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

        if (!global.chessSessions) global.chessSessions = {};
        let session = global.chessSessions[userId];

        // --- START ---
        if (action === 'start' || action === 'new') {
            session = { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', history: [] };
            global.chessSessions[userId] = session;
            
            const boardUrl = `https://lichess1.org/export/fen.gif?fen=${encodeURIComponent(session.fen)}&theme=green&piece=cburnett`;
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('♟️ Novo Jogo Iniciado')
                .setDescription('Você joga com as **Brancas**.\nUse `rp!chess <lance>` para jogar (Ex: `rp!chess e4` ou `Nf3`).')
                .setImage(boardUrl)
                .setFooter({ text: 'Avaliação: +0.20 • Engine: Stockfish 17' });

            return message.reply({ embeds: [embed] });
        }

        // --- MOVE ---
        if (action === 'move') {
            if (!session) return message.reply("⚠️ Sem jogo ativo. Use `rp!chess start`.");
            if (!move) return message.reply("⚠️ Digite o lance. Ex: `rp!chess e4`");

            // Tradução PT -> EN e Correções
            let sanitizedMove = move
                .replace(/^C/i, 'N') // Cavalo
                .replace(/^T/i, 'R') // Torre
                .replace(/^D/i, 'Q') // Dama
                .replace(/^B/i, 'B') // Bispo
                .replace(/^R/i, 'K'); // Rei

            let result = await chessBot.play_turn(session.fen, sanitizedMove);

            // Fallback para UCI (g1f3) se falhar
            if (result.error) {
                if (move.match(/^[a-h][1-8][a-h][1-8]$/)) {
                    const from = move.substring(0, 2);
                    const to = move.substring(2, 4);
                    const uciResult = await chessBot.play_turn(session.fen, { from, to });
                    
                    if (!uciResult.error) {
                        result = uciResult; // Deu certo com UCI
                    } else {
                        return message.reply(`❌ ${result.error}`);
                    }
                } else {
                    return message.reply(`❌ ${result.error}`);
                }
            }

            session.fen = result.fen;
            
            const boardUrl = `https://lichess1.org/export/fen.gif?fen=${encodeURIComponent(result.fen)}&theme=green&piece=cburnett`;
            const embed = new EmbedBuilder()
                .setTitle(result.game_over ? `🏁 Fim de Jogo: ${result.result}` : '♟️ Partida em Andamento')
                .setColor(result.game_over ? '#e74c3c' : '#2ecc71')
                .addFields(
                    { name: '👤 Você jogou:', value: `**${result.player_move}**`, inline: true },
                    { name: '💻 Stockfish respondeu:', value: `**${result.bot_move || '...'}**`, inline: true }
                )
                .setImage(boardUrl)
                .setFooter({ text: `Avaliação: ${result.evaluation || 'Calculando...'} • Stockfish 17` });

            if (result.game_over) delete global.chessSessions[userId];

            return message.reply({ embeds: [embed] });
        }
        
        if (action === 'fen') return message.reply(session ? `\`${session.fen}\`` : "Nada rolando.");
        return message.reply("**Xadrez:**\n`rp!chess start` - Começar\n`rp!chess e4` - Jogar");
    }
};

declare global {
    var chessSessions: { [key: string]: { fen: string, history: string[] } };
}