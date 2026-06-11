// RPTool/supercommands/help/search.ts
// ─── Motor de busca da Central de Ajuda ───────────────────────────────────────
// Busca por nome, alias, keyword, resumo, subcomandos e detalhes,
// ignorando acentos e maiúsculas. Retorna resultados ordenados por relevância.

import { CATEGORIES, HelpCategory, HelpEntry } from './registry';

export interface SearchResult {
    cat:   HelpCategory;
    entry: HelpEntry;
    score: number;
}

export function normalize(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')          // remove acentos (combining marks pós-NFD)
        .replace(/^rp!/, '')             // permite pesquisar "rp!oc" ou "oc"
        .trim();
}

function scoreEntry(entry: HelpEntry, q: string): number {
    const name = normalize(entry.name);

    if (name === q) return 100;
    if (entry.aliases?.some(a => normalize(a) === q)) return 90;
    if (name.startsWith(q)) return 80;
    if (name.includes(q)) return 60;
    if (entry.keywords?.some(k => {
        const nk = normalize(k);
        return nk.includes(q) || q.includes(nk);
    })) return 55;
    if (normalize(entry.summary).includes(q)) return 35;
    if (entry.subs?.some(s => normalize(`${s.usage} ${s.desc}`).includes(q))) return 25;
    if (entry.details && normalize(entry.details).includes(q)) return 15;

    return 0;
}

export function searchHelp(query: string, limit = 10): SearchResult[] {
    const q = normalize(query);
    if (!q) return [];

    const results: SearchResult[] = [];
    for (const cat of CATEGORIES) {
        for (const entry of cat.entries) {
            const score = scoreEntry(entry, q);
            if (score > 0) results.push({ cat, entry, score });
        }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
