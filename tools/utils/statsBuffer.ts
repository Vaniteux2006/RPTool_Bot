// RPTool/tools/utils/statsBuffer.ts
// ─── Buffer agregado de estatísticas de mensagens ─────────────────────────────
// PROBLEMA: cada mensagem gerava 2 ops de escrita no Mongo (ServerStats +
// UserChannelStats). Teste de carga mostrou teto de ~60 msgs/s no tier atual
// do Atlas — 120 servidores ativos estouram isso com facilidade e a fila do
// driver cresce sem limite.
//
// SOLUÇÃO: acumular os $inc em memória e descarregar a cada 15s com um único
// bulkWrite por coleção. Custo cai de 2 ops/mensagem para ~2 ops/servidor a
// cada 15s, independente do volume de mensagens.
//
// Trade-off aceito: até 15s de estatísticas podem ser perdidos em um shutdown
// abrupto (são métricas, não dados críticos).
import ServerStats, { UserChannelModel } from '../models/ServerStats';

const FLUSH_INTERVAL_MS = 15_000;
const MAX_BUFFER_KEYS   = 2_000; // válvula de segurança: flush antecipado

type IncMap = Map<string, number>;

const serverBuf      = new Map<string, { guildId: string; date: string; hour: number; incs: IncMap }>();
const userChannelBuf = new Map<string, { guildId: string; userId: string; incs: IncMap }>();

let timer: NodeJS.Timeout | null = null;
let flushing = false;

function ensureTimer(): void {
    if (timer) return;
    timer = setInterval(() => { void flushStatsBuffer(); }, FLUSH_INTERVAL_MS);
    timer.unref(); // não segura o processo vivo
}

// ─── Acumula incrementos do ServerStats (total, users.X, channels.Y, words.Z, ocs.K) ──
export function bumpServerStat(guildId: string, incs: Record<string, number>): void {
    const now  = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = now.getUTCHours();

    const key = `${guildId}|${date}|${hour}`;
    let entry = serverBuf.get(key);
    if (!entry) {
        entry = { guildId, date, hour, incs: new Map() };
        serverBuf.set(key, entry);
    }
    for (const [k, v] of Object.entries(incs)) {
        entry.incs.set(k, (entry.incs.get(k) ?? 0) + v);
    }

    ensureTimer();
    if (serverBuf.size + userChannelBuf.size > MAX_BUFFER_KEYS) void flushStatsBuffer();
}

// ─── Acumula o cruzamento usuário × canal ─────────────────────────────────────
export function bumpUserChannel(guildId: string, userId: string, channelId: string): void {
    const key = `${guildId}|${userId}`;
    let entry = userChannelBuf.get(key);
    if (!entry) {
        entry = { guildId, userId, incs: new Map() };
        userChannelBuf.set(key, entry);
    }
    const k = `channels.${channelId}`;
    entry.incs.set(k, (entry.incs.get(k) ?? 0) + 1);
    ensureTimer();
}

// ─── Flush: um bulkWrite por coleção ──────────────────────────────────────────
// Os buffers são esvaziados ANTES do await — bumps que chegarem durante a
// escrita entram no próximo ciclo sem risco de perda ou duplicação.
export async function flushStatsBuffer(): Promise<void> {
    if (flushing) return;
    flushing = true;
    try {
        if (serverBuf.size > 0) {
            const entries = [...serverBuf.values()];
            serverBuf.clear();
            await ServerStats.bulkWrite(
                entries.map(e => ({
                    updateOne: {
                        filter: { guildId: e.guildId, date: e.date, hour: e.hour },
                        update: { $inc: Object.fromEntries(e.incs) },
                        upsert: true,
                    },
                })),
                { ordered: false },
            ).catch(err => console.error('[StatsBuffer] Flush ServerStats falhou:', err));
        }

        if (userChannelBuf.size > 0) {
            const entries = [...userChannelBuf.values()];
            userChannelBuf.clear();
            await UserChannelModel.bulkWrite(
                entries.map(e => ({
                    updateOne: {
                        filter: { guildId: e.guildId, userId: e.userId },
                        update: { $inc: Object.fromEntries(e.incs) },
                        upsert: true,
                    },
                })),
                { ordered: false },
            ).catch(err => console.error('[StatsBuffer] Flush UserChannelStats falhou:', err));
        }
    } finally {
        flushing = false;
    }
}

// Tamanho atual (diagnóstico/testes)
export function statsBufferSize(): { server: number; userChannel: number } {
    return { server: serverBuf.size, userChannel: userChannelBuf.size };
}
