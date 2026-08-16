// RPTool/supercommands/console/sandbox.ts
// ─── Gerência do worker do sandbox ────────────────────────────────────────────
//
// Um worker só, mantido quente (o módulo WASM custa alguns ms pra carregar, e
// assim esse custo é pago uma vez). É criado sob demanda: quem nunca usa o
// rp!console não paga nada.
//
// DUAS garantias independentes de que nada roda pra sempre:
//   1. interrupt handler DENTRO do QuickJS  → corta o loop no bytecode (runner.js)
//   2. worker.terminate() AQUI              → se o (1) falhar por qualquer motivo,
//                                             a thread é morta no braço
// O (2) existe porque uma garantia só, dependendo do bom comportamento do próprio
// motor que estamos tentando conter, não é garantia.
//
// As execuções são SERIALIZADAS: um worker, uma fila. Dois usuários pedindo ao
// mesmo tempo não disputam o mesmo runtime nem somam CPU.
import { Worker } from 'worker_threads';
import path from 'path';
import { INSPECT_SRC } from './inspect';

export const LIMITES = {
    TIMEOUT_MS:  3_000,   // teto do interrupt handler (dentro do QuickJS)
    MARGEM_MS:   2_000,   // depois disso o worker é morto no braço
    MEMORIA_MB:  32,
    PILHA_KB:    512,     // corta recursão infinita
};

export interface Resultado {
    ok:               boolean;
    saida?:           string;   // valor de completude, já formatado
    logs?:            string;   // o que foi pro console.log
    erro?:            string;
    interrompido?:    boolean;  // bateu no timeout
    estourouMemoria?: boolean;
    morto?:           boolean;  // precisou de terminate()
}

let worker: Worker | null = null;
let proximoId = 1;
let fila: Promise<unknown> = Promise.resolve();

const pendentes = new Map<number, (r: Resultado) => void>();

function criarWorker(): Worker {
    const w = new Worker(path.join(__dirname, 'runner.js'), {
        workerData: { inspectSrc: INSPECT_SRC },
    });

    w.on('message', (msg: Resultado & { id: number }) => {
        const resolver = pendentes.get(msg.id);
        if (resolver) { pendentes.delete(msg.id); resolver(msg); }
    });

    // Se o worker morrer sozinho (crash, OOM da thread), ninguém pode ficar
    // esperando pra sempre: todo pendente é resolvido como falha.
    const derrubar = (motivo: string) => {
        for (const [id, resolver] of pendentes) {
            pendentes.delete(id);
            resolver({ ok: false, erro: motivo, morto: true });
        }
        if (worker === w) worker = null;
    };
    w.on('error', e => derrubar(`Sandbox caiu: ${e.message}`));
    w.on('exit', () => derrubar('Sandbox encerrou inesperadamente.'));

    w.unref(); // não segura o processo do bot vivo
    return w;
}

function garantirWorker(): Worker {
    if (!worker) worker = criarWorker();
    return worker;
}

async function executarAgora(codigo: string): Promise<Resultado> {
    const w = garantirWorker();
    const id = proximoId++;

    const resposta = new Promise<Resultado>(resolve => {
        pendentes.set(id, resolve);

        // Rede de segurança: o interrupt do QuickJS deveria ter cortado antes
        // disso. Se não cortou, o motor está travado — mata e recria.
        setTimeout(() => {
            if (!pendentes.has(id)) return;
            pendentes.delete(id);
            console.warn('[Console] Interrupt não respondeu — matando o worker.');
            w.terminate().catch(() => {});
            if (worker === w) worker = null;
            resolve({
                ok: false, morto: true, interrompido: true,
                erro: 'O código travou o sandbox e ele precisou ser derrubado.',
            });
        }, LIMITES.TIMEOUT_MS + LIMITES.MARGEM_MS).unref();
    });

    w.postMessage({
        id, codigo,
        timeoutMs: LIMITES.TIMEOUT_MS,
        memoriaMb: LIMITES.MEMORIA_MB,
        pilhaKb:   LIMITES.PILHA_KB,
    });

    return resposta;
}

/** Enfileira uma execução. Uma de cada vez, na ordem de chegada. */
export function executar(codigo: string): Promise<Resultado> {
    const proxima = fila.then(() => executarAgora(codigo));
    fila = proxima.catch(() => {});   // uma falha não trava a fila
    return proxima;
}
