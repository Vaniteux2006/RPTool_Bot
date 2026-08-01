// RPTool/tools/utils/ai/client.ts
// ─── Cliente de IA unificado (Gemini + OpenAI) ───────────────────────────────
// Substitui tools/api.ts, aiUtils.chamarIA e resumo/modules/aiClient.ts.
// Regras:
//   • SEMPRE com timeout — uma resposta pendurada não pode travar o handler.
//   • SEMPRE lança erro estruturado (nunca devolve o erro como texto de resposta) —
//     é o que permite classificarErroIA/withAIRetry funcionarem em cima.
//   • Safety OFF no Gemini: RP tem violência/palavrão; sem isto o bloqueio é
//     o caso comum, não a exceção.
import axios from 'axios';
import { AIConfig } from '../tokenHelper';

export type { AIConfig };

export interface ChamarIAOpts {
    /** JSON Schema do Gemini (implica resposta JSON). */
    schema?: object;
    /** Força resposta JSON mesmo sem schema (response_format/responseMimeType). */
    json?: boolean;
    /** Timeout da requisição HTTP. Default 60s. */
    timeoutMs?: number;
    temperature?: number;
}

export async function chamarIA(prompt: string, config: AIConfig, opts: ChamarIAOpts = {}): Promise<string> {
    if (!config || !config.provider) throw new Error('Configuração de IA inválida.');
    const timeout = opts.timeoutMs ?? 60_000;
    const querJson = opts.json || !!opts.schema;

    if (config.provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                ...(querJson ? { responseMimeType: 'application/json' } : {}),
                ...(opts.schema ? { responseSchema: opts.schema } : {}),
                ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        };
        const res = await axios.post(url, body, { timeout });

        const candidato = res.data?.candidates?.[0];
        if (!candidato) {
            const motivoPrompt = res.data?.promptFeedback?.blockReason;
            if (motivoPrompt) throw new Error(`PROMPT_BLOQUEADO: ${motivoPrompt}`);
            throw new Error('Gemini não retornou resposta.');
        }

        // O candidato pode existir SEM content.parts (safety, MAX_TOKENS, recitação).
        const texto = candidato.content?.parts?.[0]?.text;
        if (!texto) {
            const motivo = candidato.finishReason || 'DESCONHECIDO';
            if (motivo === 'SAFETY') throw new Error('RESPOSTA_BLOQUEADA: SAFETY');
            if (motivo === 'MAX_TOKENS') throw new Error('RESPOSTA_TRUNCADA: MAX_TOKENS');
            throw new Error(`RESPOSTA_VAZIA: ${motivo}`);
        }
        return texto;
    }

    if (config.provider === 'openai') {
        const url = 'https://api.openai.com/v1/chat/completions';
        const body = {
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            ...(querJson ? { response_format: { type: 'json_object' } } : {}),
            ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        };
        const res = await axios.post(url, body, {
            headers: { Authorization: `Bearer ${config.key}` },
            timeout,
        });
        const texto = res.data?.choices?.[0]?.message?.content;
        if (!texto) throw new Error(`RESPOSTA_VAZIA: ${res.data?.choices?.[0]?.finish_reason || 'DESCONHECIDO'}`);
        return texto;
    }

    throw new Error(`Provedor ${config.provider} não suportado.`);
}
