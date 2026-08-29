// RPTool/tools/utils/ai/retry.ts
// ─── Loop de retry padrão para chamadas de IA ────────────────────────────────
// Só insiste em falha transitória (503 / rate limit) e NUNCA para sempre —
// o retry infinito de 5 em 5s do rp!ai antigo prendia o handler num outage.
import { FalhaIA, atrasoBackoff, classificarErroIA } from './errors';

// Interface única (não union discriminada): com strict:false o TS não faz o
// narrowing de `if (!r.ok)`, então valor/falha ficam opcionais.
export interface ResultadoIA<T> {
    ok: boolean;
    /** Presente quando ok === true. */
    valor?: T;
    /** Presente quando ok === false. */
    falha?: FalhaIA;
}

export async function withAIRetry<T>(
    fn: () => Promise<T>,
    opts: {
        maxTentativas?: number;                                   // default 8 — NUNCA infinito
        onRetry?: (falha: FalhaIA, esperaSegundos: number, tentativa: number) => Promise<void> | void;
    } = {},
): Promise<ResultadoIA<T>> {
    const max = opts.maxTentativas ?? 8;

    for (let tentativa = 1; ; tentativa++) {
        try {
            return { ok: true, valor: await fn() };
        } catch (error: any) {
            const falha = classificarErroIA(error);

            // quota / bloqueio / outro: insistir não resolve — devolve na hora.
            if (falha.tipo !== 'sobrecarga' && falha.tipo !== 'ratelimit') return { ok: false, falha };
            if (tentativa >= max) return { ok: false, falha };

            const espera = falha.esperaSegundos ?? atrasoBackoff(tentativa);
            try { await opts.onRetry?.(falha, espera, tentativa); } catch { /* aviso nunca derruba o retry */ }
            await new Promise(resolve => setTimeout(resolve, espera * 1000));
        }
    }
}
