// RPTool/tools/utils/economy.ts
// ─── Helpers compartilhados da Economia (wallet + inventory) ──────────────────
import { Message, PermissionsBitField } from 'discord.js';
import { OCModel, IOC } from '../models/OCSchema';
import {
    WalletModel, IWallet,
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

// Resolve o OC-alvo de um comando de VISUALIZAÇÃO (aceita @menção pra ver o de outro).
// Sem nome e com um único OC próprio → usa esse. Retorna null se não achar.
export async function resolveTargetOc(message: Message, name: string, userId: string): Promise<IOC | null> {
    const mentioned = message.mentions.users.first();
    const ownerId = mentioned ? mentioned.id : userId;

    if (name) {
        const oc = await findOcByName(name, ownerId);
        if (oc) return oc;
        // fallback: busca global por nome (qualquer dono) quando não veio menção
        if (!mentioned) return OCModel.findOne({ name }).collation({ locale: 'pt', strength: 2 });
        return null;
    }
    // sem nome: só faz sentido pro próprio autor e se tiver exatamente um OC
    if (!mentioned) return getSoleOc(userId);
    return null;
}

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

// ─── Mutação da mochila (embedded array) ──────────────────────────────────────
// Adiciona qty do item (soma se já existir, senão insere).
export async function addItemToWallet(
    guildId: string, ocId: mongoose.Types.ObjectId, key: string, qty: number,
): Promise<void> {
    const inc = await WalletModel.updateOne(
        { guildId, ocId, 'items.key': key },
        { $inc: { 'items.$.qty': qty }, $set: { lastActivityAt: new Date() } },
    );
    if (inc.matchedCount === 0) {
        await WalletModel.updateOne(
            { guildId, ocId },
            { $push: { items: { key, qty } }, $set: { lastActivityAt: new Date() } },
        );
    }
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
