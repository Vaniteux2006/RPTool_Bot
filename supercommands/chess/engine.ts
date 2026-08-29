// RPTool/supercommands/chess/engine.ts
// ─── Wrapper da engine Stockfish ──────────────────────────────────────────────
//
// A engine é spawnada sob demanda (lazy) no primeiro lance e morre sozinha após
// 5 min ociosa — antes ela ficava viva pra sempre (~40–80 MB) sem ninguém jogando.
// Cada chamada de `bestMove` aplica o Skill Level da dificuldade da partida, então
// o mesmo processo serve partidas Fácil/Médio/Difícil sem reiniciar.
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

// ─── Permissão de execução (Linux/discloud) ───────────────────────────────────
// O binário sobe pro host sem o bit de execução; sem isto o spawn falha.
// Roda quando o módulo de xadrez carrega — o index.ts do bot não precisa saber.
const uploadedStockfishPath = '/home/node/stockfish';
try {
    if (fs.existsSync(uploadedStockfishPath)) {
        fs.chmodSync(uploadedStockfishPath, 0o755);
        console.log('♟️ [XADREZ] Permissão de execução concedida ao Stockfish com sucesso!');
    }
} catch (error) {
    console.error('❌ [XADREZ] Erro ao tentar dar permissão ao Stockfish:', error);
}

export type Difficulty = 'easy' | 'medium' | 'hard';

// Skill Level (0–20) + profundidade de busca por nível.
export const DIFFICULTY: Record<Difficulty, { skill: number; depth: number; label: string }> = {
    easy:   { skill: 2,  depth: 5,  label: 'Fácil' },
    medium: { skill: 8,  depth: 12, label: 'Médio' },
    hard:   { skill: 20, depth: 18, label: 'Difícil' },
};

export interface EngineReply {
    move: string | null;   // lance em UCI (ex: e2e4), ou null se a engine não respondeu
    eval: string | null;   // avaliação na ótica das brancas (ex: +0.42, "Mate em 3 (Brancas)")
}

class StockfishEngine {
    private process: ChildProcess | null = null;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private currentSkill = -1;
    private static readonly IDLE_MS = 5 * 60 * 1000;

    // Resolve o binário em várias localizações conhecidas (dev local vs servidor).
    private resolveBinary(): string | null {
        const isWin = process.platform === 'win32';
        const candidates = isWin
            ? [path.join(process.cwd(), 'stockfish.exe'), path.join(process.cwd(), 'stockfish')]
            : [path.join(process.cwd(), 'stockfish'), '/home/node/stockfish'];
        return candidates.find(p => fs.existsSync(p)) ?? null;
    }

    private ensureEngine(): boolean {
        this.resetIdleTimer();
        if (this.process && !this.process.killed) return true;

        const binPath = this.resolveBinary();
        if (!binPath) {
            console.error('❌ [XADREZ] Executável do Stockfish não encontrado.');
            return false;
        }

        try {
            this.process = spawn(binPath);
            this.process.on('error', (err) => console.error('❌ [XADREZ] Erro na engine:', err));
            this.process.on('exit', () => { this.process = null; this.currentSkill = -1; });
            this.send('uci');
            this.send('isready');
            console.log('♟️ [XADREZ] Engine nativa iniciada sob demanda.');
            return true;
        } catch (e) {
            console.error('❌ [XADREZ] Falha ao iniciar:', e);
            this.process = null;
            return false;
        }
    }

    private resetIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
            if (this.process && !this.process.killed) {
                this.send('quit');
                this.process.kill();
                console.log('♟️ [XADREZ] Engine encerrada por ociosidade.');
            }
            this.process = null;
            this.currentSkill = -1;
            this.idleTimer = null;
        }, StockfishEngine.IDLE_MS);
        this.idleTimer.unref();
    }

    private send(command: string) {
        if (this.process && this.process.stdin && !this.process.killed) {
            this.process.stdin.write(command + '\n');
        }
    }

    // Calcula o melhor lance para a posição (FEN) na dificuldade pedida.
    async bestMove(fen: string, difficulty: Difficulty): Promise<EngineReply> {
        if (!this.ensureEngine() || !this.process?.stdout) return { move: null, eval: null };

        const { skill, depth } = DIFFICULTY[difficulty];
        if (skill !== this.currentSkill) {
            this.send(`setoption name Skill Level value ${skill}`);
            this.currentSkill = skill;
        }

        const turn = fen.split(' ')[1]; // 'w' | 'b' — para normalizar o score pra ótica das brancas

        return new Promise<EngineReply>((resolve) => {
            const proc = this.process!;
            let lastEval: string | null = null;
            let settled = false;

            const finish = (reply: EngineReply) => {
                if (settled) return;
                settled = true;
                proc.stdout?.off('data', listener);
                clearTimeout(guard);
                resolve(reply);
            };

            const listener = (data: Buffer) => {
                for (const line of data.toString().split('\n')) {
                    if (line.startsWith('info') && line.includes('score')) {
                        const parts = line.split(' ');
                        const i = parts.indexOf('score');
                        const type = parts[i + 1];
                        const value = parseInt(parts[i + 2]);
                        if (type === 'cp') {
                            const s = (value * (turn === 'b' ? -1 : 1)) / 100;
                            lastEval = (s > 0 ? '+' : '') + s.toFixed(2);
                        } else if (type === 'mate') {
                            const m = value * (turn === 'b' ? -1 : 1);
                            lastEval = `Mate em ${Math.abs(m)} (${m > 0 ? 'Brancas' : 'Pretas'})`;
                        }
                    }
                    if (line.startsWith('bestmove')) {
                        const mv = line.split(' ')[1];
                        finish({ move: mv === '(none)' ? null : mv, eval: lastEval });
                    }
                }
            };

            // Rede de segurança: se a engine travar/morrer, não deixa a Promise pendurada.
            const guard = setTimeout(() => finish({ move: null, eval: lastEval }), 30_000);

            proc.stdout!.on('data', listener);
            this.send(`position fen ${fen}`);
            this.send(`go depth ${depth}`);
        });
    }
}

// Singleton — uma engine compartilhada por todo o processo do bot.
export const engine = new StockfishEngine();
