// RPTool/supercommands/censura/engine.ts
// ─── Motor do filtro de censura ───────────────────────────────────────────────
//
// COMO FUNCIONA:
//   1. Todo texto (mensagem E termo da lista) é NORMALIZADO caractere a
//      caractere: minúscula, sem acento, leet desfeito (@→a, 0→o, 3→e, 1→i...).
//   2. O texto normalizado é quebrado em TOKENS (sequências de [a-z0-9]),
//      guardando a posição de cada um no texto original.
//   3. Um termo casa quando seus tokens aparecem em sequência na mensagem
//      (com fronteira de palavra — "cu" não casa dentro de "curso").
//      Termos multi-palavra ("vai se foder") exigem tokens quase adjacentes
//      (até 2 chars de separação: espaço, hífen, ", ") — "foda... se liga"
//      não casa "foda-se" através de pontuação longa.
//   4. Cada caractere original dos tokens casados vira █ — pontuação e espaços
//      entre as palavras do termo são preservados ("vai, se foder" → "███, ██ █████").
//
// O cache de config por guild (TTL 5 min) evita ir ao Mongo a cada mensagem —
// ver memória de load test: leitura por mensagem só com cache.

import { CensuraConfigModel } from '../../tools/models/CensuraConfig';
import { DEFAULT_TERMS } from './wordlist';

const BLOCK = '█';

// Leet/máscaras comuns → letra real. Aplicado APÓS remover acentos.
// ⚠️ '!' NÃO entra: como vira letra, "caralho!!!" tokenizaria como "caralhoiii"
// e ESCAPARIA do filtro — pontuação no fim de palavrão é o caso mais comum.
const LEET: Record<string, string> = {
    '@': 'a', '4': 'a',
    '3': 'e',
    '1': 'i',
    '0': 'o',
    '5': 's', '$': 's',
    '7': 't',
};

const WORD_CHAR = /[a-z0-9]/;

// Distância máxima (em caracteres originais) entre palavras consecutivas de um
// termo multi-palavra: cobre espaço, hífen, ", " — mas não uma frase inteira.
const MAX_TOKEN_GAP = 2;

function normalizeChar(ch: string): string {
    // O char class abaixo contem os combining marks U+0300..U+036F literais
    // (acentos decompostos pelo NFD) - alguns editores os renderizam como vazio.
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (!base) return '';
    const c = base[0];
    return LEET[c] ?? c;
}

interface Token {
    text:  string;  // forma normalizada
    start: number;  // índice (em code points) do primeiro caractere original
    end:   number;  // índice do último caractere original (inclusivo)
}

function tokenize(content: string): { tokens: Token[]; chars: string[] } {
    // Array.from itera por code point — emoji/astrais não desalinham os índices.
    const chars = Array.from(content);
    const tokens: Token[] = [];
    let cur: Token | null = null;

    for (let i = 0; i < chars.length; i++) {
        const n = normalizeChar(chars[i]);
        if (n && WORD_CHAR.test(n)) {
            if (!cur) {
                cur = { text: '', start: i, end: i };
                tokens.push(cur);
            }
            cur.text += n;
            cur.end = i;
        } else {
            cur = null;
        }
    }
    return { tokens, chars };
}

// ─── Compilação de termos ─────────────────────────────────────────────────────

interface CompiledTerm {
    tokens: string[];  // sequência normalizada, ex: ['vai', 'se', 'foder']
    source: string;    // como foi escrito na lista/config (pra exibição)
}

export interface CompiledList {
    // Indexado pelo primeiro token — evita varrer ~300 termos por palavra da mensagem.
    byFirst: Map<string, CompiledTerm[]>;
    size:    number;
}

/** Forma canônica de um termo ("C@ralho!" → "caralho") — usada pra comparar/dedupar. */
export function normalizeTerm(source: string): string {
    return tokenize(source).tokens.map(t => t.text).join(' ');
}

export function compileTerm(source: string): CompiledTerm | null {
    const { tokens } = tokenize(source);
    if (!tokens.length) return null;
    const totalLen = tokens.reduce((s, t) => s + t.text.length, 0);
    if (totalLen < 2) return null; // termo de 1 letra censuraria letras soltas
    return { tokens: tokens.map(t => t.text), source };
}

export function compileList(sources: string[]): CompiledList {
    const byFirst = new Map<string, CompiledTerm[]>();
    const seen = new Set<string>();
    let size = 0;

    for (const src of sources) {
        const term = compileTerm(src);
        if (!term) continue;
        const key = term.tokens.join(' ');
        if (seen.has(key)) continue; // "c@ralho" ≡ "caralho" — só um entra
        seen.add(key);

        const bucket = byFirst.get(term.tokens[0]);
        if (bucket) bucket.push(term);
        else byFirst.set(term.tokens[0], [term]);
        size++;
    }

    // Termo mais longo primeiro: "vou te comer" ganha de "te comer".
    for (const bucket of byFirst.values()) {
        bucket.sort((a, b) => b.tokens.length - a.tokens.length);
    }
    return { byFirst, size };
}

// ─── Censura ──────────────────────────────────────────────────────────────────

export function censorText(list: CompiledList, content: string): { text: string; hits: number } {
    if (!content || !list.size) return { text: content, hits: 0 };

    const { tokens, chars } = tokenize(content);
    if (!tokens.length) return { text: content, hits: 0 };

    let hits = 0;
    const maskedTokens: Token[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const candidates = list.byFirst.get(tokens[i].text);
        if (!candidates) continue;

        for (const term of candidates) {
            if (i + term.tokens.length > tokens.length) continue;

            let ok = true;
            for (let j = 1; j < term.tokens.length; j++) {
                const prev = tokens[i + j - 1];
                const next = tokens[i + j];
                if (next.text !== term.tokens[j] || next.start - prev.end - 1 > MAX_TOKEN_GAP) {
                    ok = false;
                    break;
                }
            }
            if (!ok) continue;

            hits++;
            for (let j = 0; j < term.tokens.length; j++) maskedTokens.push(tokens[i + j]);
            i += term.tokens.length - 1; // pula o trecho consumido
            break;
        }
    }

    if (!hits) return { text: content, hits: 0 };

    for (const t of maskedTokens) {
        for (let k = t.start; k <= t.end; k++) chars[k] = BLOCK;
    }
    return { text: chars.join(''), hits };
}

// ─── Config por guild (cache com TTL) ─────────────────────────────────────────

export interface GuildCensor {
    enabled:  boolean;
    ignored:  Set<string>;   // canais (e canais-pai de thread) isentos
    list:     CompiledList;
    extra:    string[];      // termos adicionados pela staff (forma bruta)
    disabled: string[];      // termos padrão desativados (forma bruta)
}

const CACHE_TTL = 5 * 60_000;

const cache = new Map<string, { entry: GuildCensor; expires: number }>();

// Lista padrão compilada uma única vez por processo.
let defaultCompiled: CompiledList | null = null;
function getDefaultCompiled(): CompiledList {
    if (!defaultCompiled) defaultCompiled = compileList(DEFAULT_TERMS);
    return defaultCompiled;
}

export async function getGuildCensor(guildId: string): Promise<GuildCensor> {
    const cached = cache.get(guildId);
    if (cached && cached.expires > Date.now()) return cached.entry;

    const doc = await CensuraConfigModel.findOne({ guildId }).lean();

    // A lista é montada mesmo com o filtro desligado — rp!censura test usa ela.
    // Sem customização, todos os guilds compartilham a compilação padrão.
    const extra    = doc?.extraWords ?? [];
    const disabled = doc?.disabledWords ?? [];
    const disabledKeys = new Set(disabled.map(normalizeTerm));
    const list = (disabledKeys.size || extra.length)
        ? compileList([...DEFAULT_TERMS.filter(t => !disabledKeys.has(normalizeTerm(t))), ...extra])
        : getDefaultCompiled();

    const entry: GuildCensor = {
        enabled: !!doc?.enabled,
        ignored: new Set(doc?.ignoredChannels ?? []),
        list,
        extra,
        disabled,
    };

    cache.set(guildId, { entry, expires: Date.now() + CACHE_TTL });
    return entry;
}

/** Chamar após qualquer mudança de config (rp!censura on/off/add/...). */
export function invalidateGuildCensor(guildId: string): void {
    cache.delete(guildId);
}

/**
 * Aplica a censura do guild a um texto arbitrário — usado como content filter
 * do proxy de OC (tools/webhook.ts), pra fala de personagem também sair censurada.
 * Devolve o texto intacto se o filtro estiver desligado ou o canal for isento.
 */
export async function applyCensorship(guildId: string, channelIds: string[], text: string): Promise<string> {
    if (!text) return text;
    const censor = await getGuildCensor(guildId);
    if (!censor.enabled) return text;
    if (channelIds.some(id => censor.ignored.has(id))) return text;
    return censorText(censor.list, text).text;
}
