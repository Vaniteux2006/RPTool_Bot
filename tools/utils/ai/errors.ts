// RPTool/tools/utils/ai/errors.ts
// ─── Classificação de falha da IA ────────────────────────────────────────────
// Promovido de supercommands/resumo/modules/errors.ts — agora TODOS os
// consumidores de IA (ai, resenha, resumo, IA de OC, token) classificam igual.
// Decide a única coisa que importa: dá pra insistir ou não?
//   sobrecarga / ratelimit → transitório, retry com backoff
//   quota / bloqueio / outro → insistir não resolve, entrega o parcial

export type TipoFalha = 'sobrecarga' | 'ratelimit' | 'quota' | 'bloqueio' | 'outro';

export interface FalhaIA {
    tipo: TipoFalha;
    msg: string;
    esperaSegundos?: number;
}

// Escada de espera do retry (segundos por tentativa; a última se repete).
export const ESCADA_BACKOFF = [5, 10, 30, 60];

export function atrasoBackoff(tentativa: number): number {
    return ESCADA_BACKOFF[Math.min(tentativa - 1, ESCADA_BACKOFF.length - 1)];
}

function truncar(text: string, max: number): string {
    if (!text) return text;
    return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

// O Gemini manda o tempo de espera sugerido em error.details (RetryInfo).
function extrairRetryDelay(error: any): number | undefined {
    const detalhes = error.response?.data?.error?.details;
    if (Array.isArray(detalhes)) {
        for (const d of detalhes) {
            if (typeof d?.retryDelay === 'string') {
                const s = parseInt(d.retryDelay);
                if (!isNaN(s) && s > 0) return Math.min(s, 300);
            }
        }
    }
    const m = String(error.message || '').match(/retryDelay["\s:]+(\d+)s/i);
    return m ? Math.min(parseInt(m[1]), 300) : undefined;
}

// O Gemini NÃO diz na message se a cota estourada é a diária ou a por minuto —
// a message é genérica ("You exceeded your current quota"). Quem distingue é o
// quotaId dentro de error.details (ex.: GenerateRequestsPerDayPerProjectPerModel).
// Sem olhar os details, cota diária vira "rate limit" e o retry fica infinito à toa.
const PADRAO_COTA_DIARIA = /per\s*day|perday|daily|per_day/i;

function ehCotaDiaria(error: any, msg: string): boolean {
    if (PADRAO_COTA_DIARIA.test(msg)) return true;

    const detalhes = error.response?.data?.error?.details;
    if (Array.isArray(detalhes)) {
        for (const d of detalhes) {
            const violacoes = d?.violations;
            if (!Array.isArray(violacoes)) continue;
            for (const v of violacoes) {
                if (PADRAO_COTA_DIARIA.test(`${v?.quotaId ?? ''} ${v?.quotaMetric ?? ''}`)) return true;
            }
        }
    }
    return false;
}

// 429 de rate-limit passa em segundos; 429 de cota diária só volta na virada do
// dia. Tratar os dois igual era o que fazia o bot insistir à toa por horas.
export function classificarErroIA(error: any): FalhaIA {
    const msg = error.response?.data?.error?.message || error.message || error.toString();
    const status = error.response?.status;

    if (status === 503 || msg.includes('503') || msg.includes('Overloaded') || msg.includes('high demand')) {
        return { tipo: 'sobrecarga', msg };
    }

    if (status === 429 || msg.includes('429') || msg.includes('Too Many Requests') ||
        msg.includes('Quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        return { tipo: ehCotaDiaria(error, msg) ? 'quota' : 'ratelimit', msg, esperaSegundos: extrairRetryDelay(error) };
    }

    if (msg.includes('PROMPT_BLOQUEADO') || msg.includes('RESPOSTA_BLOQUEADA') ||
        (msg.includes('GoogleGenerativeAI Error') && msg.includes('was blocked'))) {
        return { tipo: 'bloqueio', msg };
    }

    return { tipo: 'outro', msg };
}

// A cota diária do free tier vira à meia-noite no fuso do Pacífico.
export function horasAteViradaQuota(): number {
    const agoraPT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return Math.max(1, Math.ceil(24 - agoraPT.getHours() - agoraPT.getMinutes() / 60));
}

// Rótulo curto mostrado enquanto o retry acontece.
export function rotuloRetry(falha: FalhaIA): string {
    return falha.tipo === 'sobrecarga'
        ? `🔥 **Servidores lotados (Erro 503)!** 🍟`
        : `⏱️ **Rate limit da IA** (muita requisição por minuto).`;
}

// Motivo de parada, já formatado como { titulo, detalhe }.
export function motivoInterrupcao(falha: FalhaIA): { titulo: string; detalhe: string } {
    if (falha.tipo === 'quota') {
        return {
            titulo: '🛑 **Cota diária da IA esgotada.**',
            detalhe: `Ela reseta em ~${horasAteViradaQuota()}h (meia-noite no fuso do Pacífico).`,
        };
    }
    if (falha.tipo === 'bloqueio') {
        return {
            titulo: '⚠️ **A IA bloqueou o conteúdo.**',
            detalhe: 'Algo no texto passou totalmente dos limites dela.',
        };
    }
    return { titulo: '❌ **Falha na IA.**', detalhe: truncar(falha.msg, 300) };
}

// Tradução de um erro (já fora do loop de retry) para uma frase útil ao usuário.
export function descreverErroFatal(error: any): string {
    const errorMsg = error.response?.data?.error?.message || error.message || error.toString();

    if (errorMsg.includes('PROMPT_BLOQUEADO') || errorMsg.includes('RESPOSTA_BLOQUEADA') ||
        (errorMsg.includes('GoogleGenerativeAI Error') && errorMsg.includes('was blocked'))) {
        return '⚠️ **Algo no teu texto passou totalmente dos limites e a IA não gostou. Toma cuidado aí.**';
    }
    if (errorMsg.includes('RESPOSTA_TRUNCADA')) {
        return '✂️ **A IA ficou sem espaço pra responder.** O período é grande demais — tenta um intervalo menor.';
    }
    if (errorMsg.includes('RESPOSTA_VAZIA')) {
        return `🕳️ **A IA respondeu vazio.** (${errorMsg}) Tenta de novo ou reduz o intervalo.`;
    }
    if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Quota')) {
        const limitMatch = errorMsg.match(/limit:\s*(\d+)/i);
        if (errorMsg.includes('Quota') || limitMatch) {
            const limitAmount = limitMatch ? limitMatch[1] : 'várias';
            return `🛑 **ERRO! LIMITE ATINGIDO!** A IA estourou a cota de **${limitAmount}** requisições diárias.`;
        }
        return `🔥 **CALMA AÍ!** A IA foi bloqueada por spam (Rate Limit). Tente novamente em instantes.`;
    }
    if (errorMsg.includes('503') || errorMsg.includes('Overloaded') || errorMsg.includes('high demand')) {
        return '🔥 **ERRO: ESTÃO FRITANDO OS SERVIDORES! 🍟** Alta demanda na IA do Google. Tente mais tarde.';
    }
    return '❌ Erro ao contatar a IA.';
}
