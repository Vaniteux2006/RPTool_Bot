// RPTool/tools/utils/text.ts
// ─── Utilitários de texto compartilhados ──────────────────────────────────────
// Fonte única de: escapeRegex, normalize (acentos), sanitizeOutput (anti-ping),
// tokenize (aspas) e findByName (busca case/acento-insensitive COM índice).
import { Model } from 'mongoose';

/** Escapa uma string para uso literal dentro de um RegExp. */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Minúsculas + remove acentos (São Paulo → sao paulo). */
export function normalize(str: string): string {
    return (str ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Neutraliza pings perigosos em texto que sai por webhook/IA.
 * ÚNICA fonte de verdade desta proteção — corrigir um bypass aqui corrige em
 * todos os consumidores (proxy de OC, censura, IA, transcripts).
 */
export function sanitizeOutput(text: string): string {
    if (!text) return text;
    return text
        // 'о'/'е' cirílicos (homóglifos) — o Discord não reconhece como ping
        .replace(/@everyone/g, '@everyоne')
        .replace(/@here/g, '@hеre')
        // zero-width space quebra menção de cargo sem mudar o visual
        .replace(/<@&(\d+)>/g, '<@&​$1>');
}

/**
 * Tokeniza respeitando aspas: `"Nome com espaço"` vira um token. Suporta ", ' e `.
 * tokens[0] é o próprio comando (ex: "rp!wallet"); a rota fatia a partir daí.
 */
export function tokenize(content: string): string[] {
    const tokens: string[] = [];
    const re = /"([^"]*)"|'([^']*)'|`([^`]*)`|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
        tokens.push(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
    }
    return tokens;
}

/**
 * Busca um documento por `name` de forma case- e acento-insensitive USANDO ÍNDICE
 * (collation pt strength 2), em vez de `new RegExp('^' + escapeRegex(x) + '$', 'i')`
 * — que força varredura sem índice no Mongo.
 */
export function findByName<T>(
    model: Model<T>,
    name: string,
    extraQuery: Record<string, unknown> = {},
) {
    return model
        .findOne({ name, ...extraQuery } as any)
        .collation({ locale: 'pt', strength: 2 });
}
