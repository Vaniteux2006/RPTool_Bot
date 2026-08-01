// RPTool/supercommands/resumo/modules/aiClient.ts
// ─── Cliente de IA do resumo ─────────────────────────────────────────────────
// O cliente HTTP foi promovido para tools/utils/ai/client.ts (v1.6). Aqui fica
// só o wrapper com os defaults do resumo (JSON + temperatura baixa) e o parser.
import { AIConfig, BlocoResumo } from '../types';
import { sanitizeOutput } from './text';
import { chamarIA } from '../../../tools/utils/ai/client';

export async function chamarIAResumo(prompt: string, config: AIConfig, schema?: any): Promise<string> {
    return chamarIA(prompt, config, { schema, json: true, temperature: 0.4, timeoutMs: 120_000 });
}

// Toda string que veio da IA passa pelo sanitizeOutput antes de virar embed:
// o log de origem pode conter @everyone e pings de cargo.
export function parseAIJSON(text: string): BlocoResumo {
    try {
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);

        if (parsed.sintese) parsed.sintese = sanitizeOutput(parsed.sintese);
        if (parsed.topicos) parsed.topicos = parsed.topicos.map((t: string) => sanitizeOutput(t));
        if (parsed.participantes) parsed.participantes = parsed.participantes.map((p: string) => sanitizeOutput(p));
        if (parsed.arco_geral) parsed.arco_geral = sanitizeOutput(parsed.arco_geral);
        if (parsed.conclusoes) parsed.conclusoes = parsed.conclusoes.map((c: string) => sanitizeOutput(c));

        return parsed;
    } catch (e) {
        console.error('[RESUMO] Falha ao parsear JSON da IA. Retorno:', text);
        return { sintese: 'Erro de formatação.', topicos: [], participantes: [] };
    }
}
