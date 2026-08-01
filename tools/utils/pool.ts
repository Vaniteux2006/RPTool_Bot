// RPTool/tools/utils/pool.ts
// ─── Concorrência limitada ────────────────────────────────────────────────────
// runPool: N workers consumindo uma lista (promovido do lockdown/engine.ts).
// semaphore: limite global de execuções simultâneas (padrão do exportchat/download).

/** Processa `items` com até `limit` workers em paralelo. Erros não interrompem o pool. */
export async function runPool<T>(
    items: T[], limit: number, worker: (item: T) => Promise<void>,
): Promise<{ ok: number; failed: number }> {
    let ok = 0, failed = 0, next = 0;
    const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const item = items[next++];
            try { await worker(item); ok++; } catch { failed++; }
        }
    });
    await Promise.all(lanes);
    return { ok, failed };
}

export interface Semaphore {
    /** Tenta ocupar uma vaga sem esperar. Retorna false se está cheio. */
    tryAcquire(): boolean;
    /** Libera uma vaga (chamar SEMPRE em finally). */
    release(): void;
    /** Ocupações ativas no momento. */
    readonly active: number;
}

/** Semáforo simples para limitar operações simultâneas (ex: downloads, exports). */
export function semaphore(max: number): Semaphore {
    let active = 0;
    return {
        tryAcquire() {
            if (active >= max) return false;
            active++;
            return true;
        },
        release() {
            active = Math.max(0, active - 1);
        },
        get active() { return active; },
    };
}
