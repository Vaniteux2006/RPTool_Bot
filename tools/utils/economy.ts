// RPTool/tools/utils/economy.ts
// ─── Helpers compartilhados da Economia (wallet + inventory) ──────────────────
import { Message, PermissionsBitField } from 'discord.js';
import { OCModel, IOC } from '../models/OCSchema';
import {
    WalletModel, IWallet, IWalletItem,
    ItemModel, IItem,
    GuildEconomyModel, IGuildEconomy,
} from '../models/EconomySchema';
import mongoose from 'mongoose';

// ─── Tokenização respeitando aspas ────────────────────────────────────────────
// "Nome com espaço" vira um único token. Suporta ", ' e `.
// tokens[0] é o próprio comando (ex: "rp!wallet"); a rota fatia a partir daí.
export function tokenize(content: string): string[] {
    const tokens: string[] = [];
    const re = /"([^"]*)"|'([^']*)'|`([^`]*)`|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
        tokens.push(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
    }
    return tokens;
}

// ─── Slug pra chave de item no catálogo ───────────────────────────────────────
export function slugify(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '') // remove acentos combinantes
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

// ─── Caps da mochila (compartilhados por add/levar/admin) ─────────────────────
// Quantidade: SEM limite de política — o teto é 2^53-1 (Number.MAX_SAFE_INTEGER),
// acima disso double do JS/Mongo perde precisão e o $inc erra a conta.
export const MAX_ITEM_QTY = Number.MAX_SAFE_INTEGER;
// Tipos distintos: guarda anti-abuso, não regra de RP — cada tipo cresce o doc
// da carteira (lido a cada comando) e a exibição trunca além do embed.
export const MAX_DISTINCT_ITEMS = 1000;

// ─── Exibição de quantidades ──────────────────────────────────────────────────
// Até 10 mil: número normal (9.999). Acima: notação científica (1,5 × 10¹⁰) —
// com o teto em 2^53-1, quantidades épicas não podem entupir o embed.
const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
export function formatQty(n: number): string {
    if (!Number.isFinite(n) || n <= 10_000) return n.toLocaleString('pt-BR');
    let exp = Math.floor(Math.log10(n));
    let mantissa = n / Math.pow(10, exp);
    if (Math.round(mantissa * 100) >= 1000) { mantissa /= 10; exp += 1; } // 9,999e6 → 1 × 10⁷
    const m = mantissa.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
    const sup = String(exp).split('').map(d => SUPERSCRIPT[+d]).join('');
    return `${m} × 10${sup}`;
}

// ─── Emoji de item (unicode OU emoji personalizado do servidor) ───────────────
// Emoji custom do Discord é um token `<:nome:id>` / `<a:nome:id>` com 20+ chars:
// o antigo `.slice(0, 8)` decapitava o token e virava texto quebrado — por isso
// "só funcionava emoji padrão". Custom passa inteiro; unicode (inclusive
// sequências ZWJ e bandeiras) é limitado a 16 unidades.
// O grupo de captura é o ID — usado pra checar se o bot tem acesso ao emoji.
export const CUSTOM_EMOJI_RE = /^<a?:\w{2,32}:(\d{17,20})>$/;

export function sanitizeEmoji(raw: string | undefined, fallback: string): string {
    const v = (raw || '').trim();
    if (!v) return fallback;
    if (CUSTOM_EMOJI_RE.test(v)) return v; // emoji custom, token completo
    return v.slice(0, 16);
}

// ─── Parse de valor monetário (inteiro positivo) ──────────────────────────────
// Retorna null se inválido. Aceita "1000", "1.000", "1_000".
export function parseAmount(raw: string | undefined): number | null {
    if (!raw) return null;
    const cleaned = raw.replace(/[._\s]/g, '');
    if (!/^\d+$/.test(cleaned)) return null;
    const n = parseInt(cleaned, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

// ─── Config econômica do servidor (upsert) ────────────────────────────────────
export async function getGuildEconomy(guildId: string): Promise<IGuildEconomy> {
    return GuildEconomyModel.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );
}

export function formatMoney(amount: number, econ: IGuildEconomy): string {
    return `${amount.toLocaleString('pt-BR')} ${econ.symbol}`;
}

// Preço cobrado na loja. No modo avançado com reajuste ligado, escala pelo
// índice de preço (inflação); senão usa o preço base (Fase 1).
export function effectivePrice(item: IItem, econ: IGuildEconomy): number {
    if (econ.advanced && econ.autoReprice) {
        return Math.max(0, Math.round(item.basePrice * (econ.priceIndex || 1)));
    }
    return item.basePrice;
}

// ─── Ownership ────────────────────────────────────────────────────────────────
export function isOwner(oc: IOC, userId: string): boolean {
    return oc.adminId === userId || (oc.duoIds || []).includes(userId);
}

// Staff do servidor (pode mexer em qualquer carteira/catálogo).
export function isStaff(message: Message): boolean {
    const perms = message.member?.permissions as PermissionsBitField | undefined;
    return !!perms?.has(PermissionsBitField.Flags.ManageGuild);
}

// ─── Resolução de OC ──────────────────────────────────────────────────────────
// Busca por nome (case-insensitive via collation) entre os OCs de `ownerId`.
export async function findOcByName(name: string, ownerId: string): Promise<IOC | null> {
    if (!name) return null;
    return OCModel.findOne({
        name,
        $or: [{ adminId: ownerId }, { duoIds: ownerId }],
    }).collation({ locale: 'pt', strength: 2 });
}

// OC único do autor (pra permitir `rp!wallet` sem nome quando só há um).
export async function getSoleOc(userId: string): Promise<IOC | null> {
    const query = { $or: [{ adminId: userId }, { duoIds: userId }] };
    const count = await OCModel.countDocuments(query);
    if (count !== 1) return null;
    return OCModel.findOne(query);
}

// Menção EXPLÍCITA no texto do comando. Ignora o ping automático de reply
// (message.mentions inclui o autor da mensagem respondida, o que fazia um
// simples reply mudar o "dono alvo" do comando).
export function explicitMention(message: Message) {
    const m = message.mentions.users.first();
    if (!m) return undefined;
    const inText = message.content.includes(`<@${m.id}>`) || message.content.includes(`<@!${m.id}>`);
    return inText ? m : undefined;
}

// Remove tokens de menção (<@id>) dos argumentos posicionais, pra menção em
// qualquer posição não deslocar nome/valor/quantidade.
export function stripMentionTokens(tokens: string[]): string[] {
    return tokens.filter(t => !/^<@!?\d+>$/.test(t));
}

// ─── Resolução DETERMINÍSTICA de OC no servidor ───────────────────────────────
// OCs não têm escopo de guild e nomes colidem (várias "Rem" no bot inteiro).
// Regras, nesta ordem:
//   1. @menção explícita → OC daquele dono com esse nome.
//   2. OC do próprio autor com esse nome.
//   3. OCs com esse nome cujo dono está NESTE servidor:
//      exatamente 1 → usa; 2+ → ambíguo (peça @menção); 0 → não achou.
// NUNCA cai em busca global arbitrária (era a causa do bug do add/view
// creditarem/consultarem OCs diferentes de mesmo nome).
export type GuildOcResolution =
    | { status: 'found'; oc: IOC }
    | { status: 'ambiguous'; count: number }
    | { status: 'notfound' };

export async function resolveOcInGuild(message: Message, name: string, userId: string): Promise<GuildOcResolution> {
    if (!name || !message.guild) return { status: 'notfound' };

    const mentioned = explicitMention(message);
    if (mentioned) {
        const oc = await findOcByName(name, mentioned.id);
        return oc ? { status: 'found', oc } : { status: 'notfound' };
    }

    const own = await findOcByName(name, userId);
    if (own) return { status: 'found', oc: own };

    const candidates = await OCModel.find({ name })
        .collation({ locale: 'pt', strength: 2 })
        .limit(50);
    if (!candidates.length) return { status: 'notfound' };

    // Filtra por donos presentes neste servidor.
    const ownerIds = [...new Set(candidates.flatMap(o => [o.adminId, ...(o.duoIds || [])]))];
    let present: Set<string>;
    try {
        const fetched = await message.guild.members.fetch({ user: ownerIds });
        present = new Set(fetched.keys());
    } catch {
        present = new Set(ownerIds.filter(id => message.guild!.members.cache.has(id)));
    }

    const inGuild = candidates.filter(o =>
        present.has(o.adminId) || (o.duoIds || []).some(d => present.has(d)));

    if (inGuild.length === 1) return { status: 'found', oc: inGuild[0] };
    if (inGuild.length > 1) return { status: 'ambiguous', count: inGuild.length };
    return { status: 'notfound' };
}

// Variante pra STAFF: se a resolução normal falhar, procura entre OCs que já
// TÊM carteira neste servidor (permite resetar/ajustar carteira órfã de um
// dono que saiu do servidor).
export async function resolveOcForAdmin(message: Message, name: string, userId: string): Promise<GuildOcResolution> {
    const primary = await resolveOcInGuild(message, name, userId);
    if (primary.status !== 'notfound') return primary;

    const wallets = await WalletModel.find({ guildId: message.guild!.id }, { ocId: 1 }).limit(500);
    if (!wallets.length) return { status: 'notfound' };

    const holders = await OCModel.find({ _id: { $in: wallets.map(w => w.ocId) }, name })
        .collation({ locale: 'pt', strength: 2 });

    if (holders.length === 1) return { status: 'found', oc: holders[0] };
    if (holders.length > 1) return { status: 'ambiguous', count: holders.length };
    return { status: 'notfound' };
}

export const AMBIGUOUS_MSG = '⚠️ Há **vários OCs com esse nome** neste servidor. Mencione o dono pra desambiguar, ex: `... "Nome" @dono`.';

// Resolve o OC que o autor CONTROLA (pra ações: pagar, usar, dar item...).
// Exige ownership. Sem nome e com OC único → usa esse.
export async function resolveOwnedOc(name: string, userId: string): Promise<IOC | null> {
    if (name) return findOcByName(name, userId);
    return getSoleOc(userId);
}

// ─── Carteira (upsert sob demanda) ────────────────────────────────────────────
export async function getOrCreateWallet(guildId: string, oc: IOC): Promise<IWallet> {
    return WalletModel.findOneAndUpdate(
        { guildId, ocId: oc._id },
        { $setOnInsert: { guildId, ocId: oc._id, ownerId: oc.adminId, balance: 0, items: [] } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );
}

// ─── Itens do catálogo ────────────────────────────────────────────────────────
// Resolve por slug (chave) ou por nome (case-insensitive) dentro do servidor.
export async function resolveItem(guildId: string, query: string): Promise<IItem | null> {
    if (!query) return null;
    const key = slugify(query);
    const byKey = await ItemModel.findOne({ guildId, key });
    if (byKey) return byKey;
    return ItemModel.findOne({ guildId, name: query }).collation({ locale: 'pt', strength: 2 });
}

// Metadados de um item PESSOAL (freeform). Itens de catálogo não precisam disto.
export interface CustomItemMeta { name: string; emoji?: string; custom: true; }

// ─── Mutação da mochila (embedded array) ──────────────────────────────────────
// Adiciona qty do item (soma se já existir, senão insere). `meta` é usado só na
// inserção de itens PESSOAIS — pra carregar nome/emoji próprios (o catálogo
// resolve nome/emoji pelo key, então itens de loja passam meta=undefined).
export async function addItemToWallet(
    guildId: string, ocId: mongoose.Types.ObjectId, key: string, qty: number,
    meta?: CustomItemMeta,
): Promise<void> {
    const inc = await WalletModel.updateOne(
        { guildId, ocId, 'items.key': key },
        { $inc: { 'items.$.qty': qty }, $set: { lastActivityAt: new Date() } },
    );
    if (inc.matchedCount === 0) {
        const doc: Record<string, unknown> = { key, qty };
        if (meta) { doc.name = meta.name; doc.emoji = meta.emoji || '🎒'; doc.custom = true; }
        await WalletModel.updateOne(
            { guildId, ocId },
            { $push: { items: doc }, $set: { lastActivityAt: new Date() } },
        );
    }
}

// Acha um item que o OC POSSUI na mochila (catálogo ou pessoal), por key ou nome.
export function findHeldItem(wallet: IWallet, query: string): IWalletItem | null {
    if (!query) return null;
    const key = slugify(query);
    const q = query.trim().toLowerCase();
    return wallet.items.find(i =>
        i.key === key || (i.name && i.name.trim().toLowerCase() === q)) || null;
}

// Remove qty do item de forma ATÔMICA (só se houver quantidade suficiente).
// Retorna true se removeu, false se não tinha o bastante.
export async function removeItemFromWallet(
    guildId: string, ocId: mongoose.Types.ObjectId, key: string, qty: number,
): Promise<boolean> {
    const dec = await WalletModel.findOneAndUpdate(
        { guildId, ocId, items: { $elemMatch: { key, qty: { $gte: qty } } } },
        { $inc: { 'items.$.qty': -qty }, $set: { lastActivityAt: new Date() } },
        { new: true },
    );
    if (!dec) return false;
    // Limpa entradas zeradas.
    await WalletModel.updateOne(
        { guildId, ocId },
        { $pull: { items: { qty: { $lte: 0 } } } },
    );
    return true;
}
