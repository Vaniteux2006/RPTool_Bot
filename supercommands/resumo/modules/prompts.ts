// RPTool/supercommands/resumo/modules/prompts.ts
// ─── Prompts e schemas de saída ──────────────────────────────────────────────
// Com responseSchema o modelo não tem como devolver markdown, preâmbulo ou chave
// faltando — que era a principal forma de queimar requisição.
import { BlocoResumo } from '../types';

export const SCHEMA_BLOCO = {
    type: 'OBJECT',
    properties: {
        topicos: { type: 'ARRAY', items: { type: 'STRING' } },
        sintese: { type: 'STRING' },
        participantes: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['topicos', 'sintese', 'participantes'],
};

export const SCHEMA_COMPLETO = {
    type: 'OBJECT',
    properties: {
        topicos: { type: 'ARRAY', items: { type: 'STRING' } },
        sintese: { type: 'STRING' },
        participantes: { type: 'ARRAY', items: { type: 'STRING' } },
        arco_geral: { type: 'STRING' },
        conclusoes: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['topicos', 'sintese', 'participantes', 'arco_geral', 'conclusoes'],
};

export const SCHEMA_SUPER = {
    type: 'OBJECT',
    properties: {
        arco_geral: { type: 'STRING' },
        conclusoes: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['arco_geral', 'conclusoes'],
};

// Bloco único pede o arco geral JUNTO — assim o "Resumo Definitivo" sai de graça,
// sem uma segunda requisição.
export function promptBloco(log: string, blocoUnico: boolean): string {
    return blocoUnico
        ? `Analise este log de RP e produza um resumo completo do período.
Responda ESTRITAMENTE em JSON com as chaves abaixo:
- "topicos": lista de assuntos abordados (strings curtas)
- "sintese": o que aconteceu, em 1 parágrafo
- "participantes": uma string por personagem, no formato "Nome fez X"
- "arco_geral": a narrativa completa do período, em prosa corrida
- "conclusoes": desdobramentos, no formato "A levou a B"
Log:\n${log}`
        : `Analise este log de RP. Responda ESTRITAMENTE em JSON:
{ "topicos": ["assunto 1"], "sintese": "O que aconteceu (1 parágrafo)", "participantes": ["A fez algo"] }
Log:\n${log}`;
}

export function promptSuper(resumos: BlocoResumo[]): string {
    return `Sintetize estes resumos em uma narrativa única.\n${JSON.stringify(resumos)}\nResponda ESTRITAMENTE em JSON:\n{ "arco_geral": "História inteira", "conclusoes": ["A levou a B"] }`;
}
