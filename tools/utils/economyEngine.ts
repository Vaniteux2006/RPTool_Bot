// RPTool/tools/utils/economyEngine.ts
// ─── Motor macroeconômico (Fase 2, opt-in por servidor) ───────────────────────
// Baseado na Teoria Quantitativa da Moeda: M · V = P · Q
//   M = oferta monetária (Σ saldos)     Q = riqueza real (Σ valor de itens)
//   V = velocidade (volume/janela ÷ M)  P = índice de preço (inflação)
import {
    WalletModel, ItemModel, GuildEconomyModel, EconomyLedgerModel,
    IGuildEconomy, LedgerType,
} from '../models/EconomySchema';
import { getGuildEconomy } from './economy';

// ─── Parâmetros do modelo ─────────────────────────────────────────────────────
const ALPHA = 0.3;                 // peso da velocidade sobre o preço
const EPS = 1e-6;                  // guarda contra divisão por ~0
const PRICE_MIN = 0.1;             // deflação máxima (preços a 10% do base)
const PRICE_MAX = 10;              // inflação máxima (preços a 10× o base)
const VELOCITY_WINDOW_DAYS = 7;    // janela pra medir a velocidade
const GDP_WINDOW_DAYS = 7;         // janela pra medir o PIB
const HISTORY_CAP = 60;            // pontos guardados pro gráfico
const DAY_MS = 86_400_000;

// Tipos de transação que contam como "atividade econômica real" (velocidade/PIB).
const ACTIVITY_TYPES: LedgerType[] = ['transfer', 'buy', 'sell'];

function clamp(x: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, x));
}

// ─── Registro no ledger (fire-and-forget) ─────────────────────────────────────
export function recordLedger(guildId: string, type: LedgerType, amount: number): void {
    if (!amount || amount <= 0) return;
    EconomyLedgerModel.create({ guildId, type, amount }).catch(() => { /* TTL/efêmero — ignora falha */ });
}

// ─── Oferta monetária (M) e riqueza real (Q) do servidor ──────────────────────
export async function snapshotMQ(guildId: string): Promise<{ M: number; Q: number }> {
    const items = await ItemModel.find({ guildId }, { key: 1, basePrice: 1 });
    const priceByKey = new Map(items.map(i => [i.key, i.basePrice]));

    const wallets = await WalletModel.find({ guildId }, { balance: 1, items: 1 });
    let M = 0, Q = 0;
    for (const w of wallets) {
        M += w.balance;
        for (const it of w.items) Q += (priceByKey.get(it.key) || 0) * it.qty;
    }
    return { M, Q };
}

// ─── Volume transacionado numa janela (soma de |amount|) ──────────────────────
export async function windowVolume(guildId: string, days: number, types: LedgerType[] = ACTIVITY_TYPES): Promise<number> {
    const since = new Date(Date.now() - days * DAY_MS);
    const agg = await EconomyLedgerModel.aggregate([
        { $match: { guildId, type: { $in: types }, createdAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return agg[0]?.total || 0;
}

// ─── Recalcula o estado econômico do servidor e persiste ──────────────────────
export async function recomputeEconomy(guildId: string): Promise<IGuildEconomy> {
    const econ = await getGuildEconomy(guildId);

    const { M, Q } = await snapshotMQ(guildId);
    const volume = await windowVolume(guildId, VELOCITY_WINDOW_DAYS);
    const V = volume / Math.max(M, 1);
    const gdp = await windowVolume(guildId, GDP_WINDOW_DAYS);

    // Índice de preço só faz sentido no modo avançado (senão fica travado em 1).
    let priceIndex = 1;
    if (econ.advanced) {
        const Mr = M / Math.max(econ.genesisMoneySupply, 1);
        const Qr = econ.genesisRealWealth > 0 ? Q / econ.genesisRealWealth : 1;
        const Vr = econ.genesisVelocity > 0 ? V / econ.genesisVelocity : 1;
        priceIndex = clamp((Mr / Math.max(Qr, EPS)) * Math.pow(Math.max(Vr, EPS), ALPHA), PRICE_MIN, PRICE_MAX);
    }

    econ.moneySupply = M;
    econ.realWealth = Q;
    econ.velocity = V;
    econ.priceIndex = priceIndex;
    econ.lastRecompute = new Date();

    econ.history.push({ at: new Date(), priceIndex, moneySupply: M, realWealth: Q, velocity: V, gdp });
    if (econ.history.length > HISTORY_CAP) {
        econ.history.splice(0, econ.history.length - HISTORY_CAP);
    }

    await econ.save();
    return econ;
}

// ─── Liga o modo avançado capturando os baselines (genesis) ───────────────────
export async function enableAdvanced(guildId: string): Promise<IGuildEconomy> {
    const econ = await getGuildEconomy(guildId);

    const { M, Q } = await snapshotMQ(guildId);
    const volume = await windowVolume(guildId, VELOCITY_WINDOW_DAYS);
    const V = volume / Math.max(M, 1);

    econ.advanced = true;
    econ.advancedSince = new Date();
    econ.genesisMoneySupply = M;
    econ.genesisRealWealth = Q;
    econ.genesisVelocity = V;
    econ.moneySupply = M;
    econ.realWealth = Q;
    econ.velocity = V;
    econ.priceIndex = 1;
    econ.lastRecompute = new Date();
    econ.history = [{ at: new Date(), priceIndex: 1, moneySupply: M, realWealth: Q, velocity: V, gdp: 0 }];

    await econ.save();
    return econ;
}

// ─── Re-captura os baselines mantendo o modo avançado ligado ──────────────────
export async function rebaseline(guildId: string): Promise<IGuildEconomy> {
    return enableAdvanced(guildId);
}

// ─── Recalcula todos os servidores em modo avançado (rotina periódica) ────────
export async function recomputeAllAdvanced(): Promise<void> {
    const guilds = await GuildEconomyModel.find({ advanced: true }, { guildId: 1 });
    for (const g of guilds) {
        await recomputeEconomy(g.guildId).catch(e => console.error('[ECON] recompute', g.guildId, e));
    }
}

// Câmbio: quanto vale 1 moeda em dólar fictício, corroído pela inflação.
export function coinToUsd(coins: number, econ: IGuildEconomy): number {
    return coins * econ.baseUsdRate / (econ.priceIndex || 1);
}
