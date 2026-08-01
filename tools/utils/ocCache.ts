// RPTool/tools/utils/ocCache.ts
// ─── Curto-circuito das queries de OC por mensagem ───────────────────────────
// O proxy de OC e a IA de OC faziam um OCModel.find() em CADA messageCreate de
// CADA servidor — o teto de ~120 ops/s do bot inteiro vinha daqui.
// Estes dois Sets em memória respondem "esse autor tem OC?" e "esse canal tem
// IA ativa?" sem tocar no Mongo. Se a resposta é não (o caso de ~99% das
// mensagens), o handler retorna imediatamente.
//
// Populado no boot (ClientReady) e invalidado pelos comandos que mudam o estado:
//   donos   → oc create / delete / purge / import / duo / solo
//   canais  → oc insert / end / puppet / auto
// Antes do load terminar, tudo retorna true (fail-open: cai na query normal).
import { OCModel } from '../models/OCSchema';
import { EventCheckout } from '../eventCheckout';

let loaded = false;
const ownerIds = new Set<string>();
const aiChannelIds = new Set<string>();

async function loadAll(): Promise<void> {
    const [admins, duos, channels] = await Promise.all([
        OCModel.distinct('adminId'),
        OCModel.distinct('duoIds'),
        OCModel.distinct('ai.activeChannelId', { 'ai.enabled': true }),
    ]);
    ownerIds.clear();
    for (const id of admins) if (id) ownerIds.add(String(id));
    for (const id of duos) if (id) ownerIds.add(String(id));
    aiChannelIds.clear();
    for (const id of channels) if (id) aiChannelIds.add(String(id));
    loaded = true;
    console.log(`🎭 [OCCache] ${ownerIds.size} donos de OC e ${aiChannelIds.size} canais com IA em cache.`);
}

EventCheckout.onClientReady('oc.cacheWarmup', async () => {
    try {
        await loadAll();
    } catch (e) {
        console.error('❌ [OCCache] Falha no warmup (seguindo em fail-open):', e);
    }
});

// ─── Consultas (síncronas, zero Mongo) ───────────────────────────────────────

/** O usuário tem pelo menos um OC (dono ou duo)? Fail-open antes do load. */
export function userHasOC(userId: string): boolean {
    return !loaded || ownerIds.has(userId);
}

/** O canal tem pelo menos um OC com IA ativa? Fail-open antes do load. */
export function channelHasAI(channelId: string): boolean {
    return !loaded || aiChannelIds.has(channelId);
}

// ─── Invalidações ─────────────────────────────────────────────────────────────

/** Chamado quando um usuário GANHA um OC (create/import/duo). */
export function markUserHasOC(userId: string): void {
    if (userId) ownerIds.add(userId);
}

/** Chamado após um usuário PODER ter perdido o último OC (delete/purge/solo). */
export async function recheckUserOC(userId: string): Promise<void> {
    if (!userId || !loaded) return;
    try {
        const ainda = await OCModel.exists({ $or: [{ adminId: userId }, { duoIds: userId }] });
        if (!ainda) ownerIds.delete(userId);
    } catch { /* na dúvida, mantém no Set (fail-open) */ }
}

/** Chamado quando um canal GANHA IA de OC (insert/auto on). */
export function markAIChannel(channelId: string): void {
    if (channelId) aiChannelIds.add(channelId);
}

/** Chamado após um canal PODER ter perdido a última IA (end/puppet/auto off). */
export async function recheckAIChannel(channelId: string): Promise<void> {
    if (!channelId || !loaded) return;
    try {
        const ainda = await OCModel.exists({ 'ai.enabled': true, 'ai.activeChannelId': channelId });
        if (!ainda) aiChannelIds.delete(channelId);
    } catch { /* fail-open */ }
}
