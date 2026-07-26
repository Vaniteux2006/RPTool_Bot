// RPTool/supercommands/resumo/modules/aiClient.ts
// ─── Cliente de IA do resumo ─────────────────────────────────────────────────
// Cliente próprio (e não o tools/api.ts) porque este é o único lugar que precisa
// de responseSchema — o schema é o que garante JSON válido e evita queimar
// requisição com markdown/preâmbulo. Ver §9 da DOCUMENTACAO (dívida: unificar).
import axios from 'axios';
import { AIConfig, BlocoResumo } from '../types';
import { sanitizeOutput } from './text';

export async function chamarIAResumo(prompt: string, config: AIConfig, schema?: any): Promise<string> {
    if (!config || !config.provider) throw new Error('Configuração de IA inválida.');

    if (config.provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                ...(schema ? { responseSchema: schema } : {}),
                temperature: 0.4,
            },
            // RP tem violência, palavrão e conteúdo adulto — sem isto o bloqueio é
            // o caso comum, não a exceção. Mesmo ajuste que api.ts já fazia.
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        };
        const res = await axios.post(url, body);

        const candidato = res.data?.candidates?.[0];
        if (!candidato) {
            const motivoPrompt = res.data?.promptFeedback?.blockReason;
            if (motivoPrompt) throw new Error(`PROMPT_BLOQUEADO: ${motivoPrompt}`);
            throw new Error('Gemini não retornou resposta.');
        }

        // O candidato pode existir SEM content.parts (safety, MAX_TOKENS, recitação).
        // Sem esta checagem virava TypeError e caía no catch genérico com a mensagem errada.
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
        const url = `https://api.openai.com/v1/chat/completions`;
        const body = {
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
        };
        const res = await axios.post(url, body, { headers: { Authorization: `Bearer ${config.key}` } });
        const texto = res.data?.choices?.[0]?.message?.content;
        if (!texto) throw new Error(`RESPOSTA_VAZIA: ${res.data?.choices?.[0]?.finish_reason || 'DESCONHECIDO'}`);
        return texto;
    }

    throw new Error(`Provedor ${config.provider} não suportado.`);
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
