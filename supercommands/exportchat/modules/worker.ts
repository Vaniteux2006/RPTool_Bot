// RPTool/supercommands/exportchat/modules/worker.ts
// ─── Worker de fetch por dia ──────────────────────────────────────────────────
// Cada worker recebe uma fila de DaySegments e processa um dia por vez.
// Escreve mensagens diretamente no arquivo de segmento — sem acumular em RAM.
// Quando a fila esvazia, o worker termina.

import fs   from 'fs';
import path from 'path';
import { TextChannel } from 'discord.js';
import { DaySegment, dateToSnowflake } from './parseArgs';
import { SegmentRenderer }              from './SegmentRenderer';
import { ProgressTracker }              from './ProgressTracker';

// Rate limit: 5 req/s por rota — com 3 workers, adicionamos backoff leve
// entre cada fetch pra não estourar o bucket do mesmo canal.
const FETCH_DELAY_MS = 250; // ~4 req/s por worker → 12 req/s total com 3 workers
const MAX_RETRIES    = 3;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export interface WorkerResult {
    segmentsWritten: number;
    totalMessages:   number;
    errors:          string[];
}

export async function runWorker(
    workerId:    number,
    queue:       DaySegment[],       // fila compartilhada — workers consomem do início
    sessionPath: string,
    channel:     TextChannel,
    renderer:    SegmentRenderer,
    progress:    ProgressTracker,
    cancelled:   () => boolean,      // callback para checar se foi cancelado
): Promise<WorkerResult> {
    const result: WorkerResult = { segmentsWritten: 0, totalMessages: 0, errors: [] };

    while (queue.length > 0) {
        if (cancelled()) break;

        // Pega o próximo dia da fila (atomic — JS é single-threaded, sem race)
        const segment = queue.shift();
        if (!segment) break;

        const segFilePath = path.join(sessionPath, `seg_${segment.key}.html`);

        console.log(`[Worker ${workerId}] Processando ${segment.key} (${segment.start.toLocaleDateString('pt-BR')})`);

        let afterId = dateToSnowflake(new Date(segment.start.getTime() - 1));
        let retries = 0;

        try {
            while (true) {
                if (cancelled()) break;

                let fetched;
                try {
                    fetched = await channel.messages.fetch({ limit: 100, after: afterId });
                    retries = 0; // reset ao ter sucesso
                } catch (err: any) {
                    // Rate limit (429) ou erro de rede — retry com backoff exponencial
                    if (retries < MAX_RETRIES) {
                        retries++;
                        const delay = FETCH_DELAY_MS * Math.pow(2, retries);
                        console.warn(`[Worker ${workerId}] Retry ${retries}/${MAX_RETRIES} após ${delay}ms — ${err?.message ?? err}`);
                        await sleep(delay);
                        continue;
                    }
                    throw err;
                }

                if (fetched.size === 0) break;

                const sorted = [...fetched.values()]
                    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

                for (const msg of sorted) {
                    // Passou do fim do dia — encerra o loop deste segmento
                    if (msg.createdTimestamp > segment.end.getTime()) {
                        fetched = null as any;
                        break;
                    }
                    if (msg.createdTimestamp < segment.start.getTime()) continue;

                    // Escreve diretamente no disco via SegmentRenderer
                    await renderer.writeMessage(msg, segFilePath);
                    progress.increment(msg.createdAt);
                    result.totalMessages++;
                }

                if (!fetched) break; // sinal de que passou do fim do dia

                afterId = sorted[sorted.length - 1].id;
                await sleep(FETCH_DELAY_MS);
            }

            result.segmentsWritten++;
            progress.finishDay();
            console.log(`[Worker ${workerId}] Dia ${segment.key} concluído (${result.totalMessages} msgs acumuladas)`);

        } catch (err: any) {
            const msg = `Worker ${workerId} falhou no dia ${segment.key}: ${err?.message ?? err}`;
            console.error('[exportchat]', msg);
            result.errors.push(msg);
            // Não re-adiciona na fila — segmento fica vazio/ausente, merger lida com isso
        }
    }

    return result;
}
