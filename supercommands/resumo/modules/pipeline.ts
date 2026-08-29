// RPTool/supercommands/resumo/modules/pipeline.ts
// ─── Loop de blocos ──────────────────────────────────────────────────────────
// Uma requisição por bloco, com retry infinito só para falha transitória
// (503 / rate limit). Falha não recuperável PARA o loop mas devolve o que já foi
// processado: requisição paga nunca é descartada.
import { Message } from 'discord.js';
import { AIConfig, BlocoResumo, Interrupcao } from '../types';
import { chamarIAResumo, parseAIJSON } from './aiClient';
import { atrasoBackoff, classificarErroIA, motivoInterrupcao, rotuloRetry } from './errors';
import { SCHEMA_BLOCO, SCHEMA_COMPLETO, promptBloco } from './prompts';

export interface ResultadoPipeline {
    resumos: BlocoResumo[];
    interrompido: Interrupcao | null;
}

export async function processarBlocos(
    loadMsg: Message,
    logs: string[],
    blocoUnico: boolean,
    aiConfig: AIConfig,
    totalMensagens: number,
): Promise<ResultadoPipeline> {
    const resumos: BlocoResumo[] = [];
    let interrompido: Interrupcao | null = null;
    let etaTexto = 'Calculando...';

    for (let i = 0; i < logs.length; i++) {
        await loadMsg.edit(blocoUnico
            ? `🧠 **Lendo ${totalMensagens} mensagens numa requisição só...** ⏳`
            : `🧠 **Processando Bloco ${i + 1} de ${logs.length}...** ⏳ ${etaTexto}`);

        const inicioBloco = Date.now();
        // Sem substring(): o bloco já foi dimensionado para caber inteiro.
        const prompt = promptBloco(logs[i], blocoUnico);

        let bruto = '';
        let tentativa = 1;
        let ok = false;

        while (!ok) {
            try {
                bruto = await chamarIAResumo(prompt, aiConfig, blocoUnico ? SCHEMA_COMPLETO : SCHEMA_BLOCO);
                ok = true;
            } catch (error: any) {
                const falha = classificarErroIA(error);

                // Transitório (503 / rate limit): retry infinito, com backoff.
                if (falha.tipo === 'sobrecarga' || falha.tipo === 'ratelimit') {
                    const espera = falha.esperaSegundos ?? atrasoBackoff(tentativa);
                    console.warn(`[RESUMO] Retry ${tentativa} na parte ${i + 1} (${falha.tipo}):`, falha.msg);
                    await loadMsg.edit(`${rotuloRetry(falha)}\n🔄 Tentando a parte ${i + 1} de novo em ${espera}s... (tentativa ${tentativa})`).catch(() => { });
                    await new Promise(resolve => setTimeout(resolve, espera * 1000));
                    tentativa++;
                    continue;
                }

                // Insistir não resolve. Para o loop, mas guarda o motivo — o que
                // já foi processado será renderizado como resumo parcial.
                if (falha.tipo === 'outro') console.error(`[RESUMO] Falha não recuperável na parte ${i + 1}:`, falha.msg);
                interrompido = motivoInterrupcao(falha);
                break;
            }
        }

        if (interrompido) break;

        resumos.push(parseAIJSON(bruto));

        if (i === 0 && logs.length > 1) {
            const decorrido = Date.now() - inicioBloco;
            const etaSeg = Math.ceil((decorrido * (logs.length - 1)) / 1000);
            etaTexto = etaSeg > 60 ? `(~${Math.ceil(etaSeg / 60)} min restantes)` : `(~${etaSeg} seg restantes)`;
        }
    }

    return { resumos, interrompido };
}
