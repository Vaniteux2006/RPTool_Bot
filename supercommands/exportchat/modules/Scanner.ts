// RPTool/supercommands/exportchat/modules/scanner.ts
// ─── Pre-scan paralelo de dias ────────────────────────────────────────────────
// Antes de exportar, verifica rapidamente quais dias têm mensagens.
// Cada "scanner" busca apenas 1 mensagem por dia para confirmar se o dia
// tem conteúdo — se a mensagem mais antiga após dayStart ainda está dentro
// do dia, o dia vai pra fila de export. Caso contrário, é descartado.
//
// Vantagem: com 30 dias sendo verificados, por exemplo, em vez de 3 workers
// gastarem um loop inteiro em cada dia vazio, 8 scanners confirmam em ~1s
// quais dias realmente têm mensagens antes de qualquer trabalho pesado.

import { TextChannel } from 'discord.js';
import { DaySegment, dateToSnowflake } from './parseArgs';

const NUM_SCANNERS   = 8;   // mais scanners pois cada um faz só 1 fetch
const SCAN_DELAY_MS  = 150; // ~6 req/s por scanner → ~48 req/s total, dentro do limite
const MAX_RETRIES    = 2;

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export interface ScanResult {
    activeDays:  DaySegment[]; // dias com pelo menos 1 mensagem (em ordem cronológica)
    skippedDays: number;       // dias sem nenhuma mensagem
}

/**
 * Verifica em paralelo quais dias da fila têm mensagens.
 * Retorna apenas os dias ativos, já ordenados cronologicamente.
 *
 * @param dayQueue  Fila de dias gerada por buildDayQueue()
 * @param channel   Canal a ser verificado
 * @param onProgress Callback opcional chamado após cada dia verificado
 */
export async function scanActiveDays(
    dayQueue:    DaySegment[],
    channel:     TextChannel,
    onProgress?: (scanned: number, total: number) => void,
): Promise<ScanResult> {
    const queue      = [...dayQueue]; // cópia — os scanners fazem .shift()
    const activeDays: DaySegment[] = [];
    const total = dayQueue.length;
    let scanned = 0;

    // Lança os scanners em paralelo
    const scanners = Array.from({ length: NUM_SCANNERS }, () =>
        runScanner(queue, channel, activeDays, () => {
            scanned++;
            onProgress?.(scanned, total);
        }),
    );

    await Promise.all(scanners);

    // Garante ordem cronológica (os scanners terminam fora de ordem)
    activeDays.sort((a, b) => a.key.localeCompare(b.key));

    return {
        activeDays,
        skippedDays: total - activeDays.length,
    };
}

// ─── Scanner individual ───────────────────────────────────────────────────────
async function runScanner(
    queue:      DaySegment[],
    channel:    TextChannel,
    results:    DaySegment[],
    onDone:     () => void,
): Promise<void> {
    while (queue.length > 0) {
        const day = queue.shift();
        if (!day) break;

        const hasMsg = await checkDay(day, channel);

        if (hasMsg) {
            results.push(day); // JS é single-thread: push concorrente é seguro
        }

        onDone();
        await sleep(SCAN_DELAY_MS);
    }
}

// ─── Verifica se um único dia tem mensagens ───────────────────────────────────
async function checkDay(day: DaySegment, channel: TextChannel): Promise<boolean> {
    const afterId = dateToSnowflake(new Date(day.start.getTime() - 1));
    let retries   = 0;

    while (retries <= MAX_RETRIES) {
        try {
            const fetched = await channel.messages.fetch({ limit: 1, after: afterId });

            if (fetched.size === 0) return false; // canal não tem mais mensagens a partir daqui

            const msg = fetched.first()!;
            // A mensagem mais antiga após dayStart está dentro do dia?
            return msg.createdTimestamp <= day.end.getTime();

        } catch {
            retries++;
            if (retries > MAX_RETRIES) {
                // Em caso de erro persistente, inclui o dia por segurança
                // (o worker vai lidar com ele normalmente)
                return true;
            }
            await sleep(SCAN_DELAY_MS * Math.pow(2, retries));
        }
    }

    return true; // fallback seguro
}