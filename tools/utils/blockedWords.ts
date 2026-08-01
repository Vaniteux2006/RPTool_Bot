// RPTool/tools/utils/blockedWords.ts
// ─── Blocklist de palavras do rp!ignorar ─────────────────────────────────────
// Cache em memória por guild — trackMessageStats roda a cada mensagem, então a
// blocklist NUNCA pode virar query por mensagem. A query acontece uma vez por
// guild (primeira mensagem após o boot) e nas invalidações do rp!ignorar.
import { BlockedWordsModel } from '../models/ServerStats';

const blockedWordsCache = new Map<string, Set<string>>();

/** (Re)carrega a blocklist de um guild do Mongo para o cache. */
export async function loadBlockedWords(guildId: string): Promise<Set<string>> {
    const doc = await BlockedWordsModel.findOne({ guildId });
    const set = new Set<string>(doc?.words ?? []);
    blockedWordsCache.set(guildId, set);
    return set;
}

/** Blocklist do guild — usa o cache; só consulta o Mongo na primeira vez. */
export async function getBlockedWords(guildId: string): Promise<Set<string>> {
    return blockedWordsCache.get(guildId) ?? loadBlockedWords(guildId);
}

/** Invalida o cache de um guild (chamar após alterar a lista no Mongo). */
export function invalidateBlockedWords(guildId: string): void {
    blockedWordsCache.delete(guildId);
}
