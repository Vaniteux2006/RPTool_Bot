// RPTool/supercommands/exportchat/modules/worker.ts
// ─── Worker de fetch por dia ──────────────────────────────────────────────────
// FIX: dias sem mensagens — o primeiro fetch retorna 0 itens dentro da janela
// do dia → pular imediatamente sem criar arquivo de segmento nem contar como erro.

import fs   from 'fs';
import path from 'path';
import { TextChannel } from 'discord.js';
import { DaySegment, dateToSnowflake } from './parseArgs';
import { SegmentRenderer }              from './SegmentRenderer';
import { ProgressTracker }              from './ProgressTracker';

const FETCH_DELAY_MS = 250; // ~4 req/s por worker → 12 req/s total com 3 workers
const MAX_RETRIES    = 3;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export interface WorkerResult {
    segmentsWritten: number;
    totalMessages:   number;
    skippedDays:     number; // FIX: dias ignorados por não ter mensagens
    errors:          string[];
}

export async function runWorker(
    workerId:    number,
    queue:       DaySegment[],
    sessionPath: string,
    channel:     TextChannel,
    renderer:    SegmentRenderer,
    progress:    ProgressTracker,
    cancelled:   () => boolean,
): Promise<WorkerResult> {
    const result: WorkerResult = {
        segmentsWritten: 0,
        totalMessages:   0,
        skippedDays:     0,
        errors:          [],
    };

    while (queue.length > 0) {
        if (cancelled()) break;

        const segment = queue.shift();
        if (!segment) break;

        const segFilePath = path.join(sessionPath, `seg_${segment.key}.html`);
        let afterId       = dateToSnowflake(new Date(segment.start.getTime() - 1));
        let retries       = 0;
        let msgsThisDay   = 0; // FIX: contador local para detectar dia vazio

        try {
            while (true) {
                if (cancelled()) break;

                let fetched;
                try {
                    fetched = await channel.messages.fetch({ limit: 100, after: afterId });
                    retries = 0;
                } catch (err: any) {
                    if (retries < MAX_RETRIES) {
                        retries++;
                        const delay = FETCH_DELAY_MS * Math.pow(2, retries);
                        console.warn(`[Worker ${workerId}] Retry ${retries}/${MAX_RETRIES} após ${delay}ms`);
                        await sleep(delay);
                        continue;
                    }
                    throw err;
                }

                // FIX: primeiro fetch retornou 0 → canal não tem msgs neste dia
                // Não cria arquivo, não conta como erro, não chama progress.finishDay()
                if (fetched.size === 0) break;

                const sorted = [...fetched.values()]
                    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

                let passedEndOfDay = false;
                for (const msg of sorted) {
                    if (msg.createdTimestamp > segment.end.getTime()) {
                        passedEndOfDay = true;
                        break;
                    }
                    if (msg.createdTimestamp < segment.start.getTime()) continue;

                    await renderer.writeMessage(msg, segFilePath);
                    progress.increment(msg.createdAt);
                    result.totalMessages++;
                    msgsThisDay++;
                }

                if (passedEndOfDay) break;

                afterId = sorted[sorted.length - 1].id;
                await sleep(FETCH_DELAY_MS);
            }

            // FIX: só conta como segmento concluído se teve mensagens
            if (msgsThisDay > 0) {
                result.segmentsWritten++;
                progress.finishDay();
                console.log(`[Worker ${workerId}] ${segment.key} ✓ ${msgsThisDay} msgs`);
            } else {
                result.skippedDays++;
                // Deleta o arquivo de segmento se foi criado vazio por acidente
                if (fs.existsSync(segFilePath)) fs.unlinkSync(segFilePath);
                console.log(`[Worker ${workerId}] ${segment.key} — vazio, ignorado`);
            }

        } catch (err: any) {
            const errMsg = `Worker ${workerId} falhou no dia ${segment.key}: ${err?.message ?? err}`;
            console.error('[exportchat]', errMsg);
            result.errors.push(errMsg);
            if (fs.existsSync(segFilePath)) fs.unlinkSync(segFilePath);
        }
    }

    return result;
}
