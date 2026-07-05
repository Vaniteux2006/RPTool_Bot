import mongoose, { Schema, Document } from 'mongoose';
import 'dotenv/config';

// ─── Conexão exclusiva da Economia (PERSISTENTE — sem TTL) ────────────────────
// Reusa o padrão das outras conexões (createConnection por env var), mas os dados
// aqui são permanentes: carteira, mochila e loja de cada OC não expiram.
if (!process.env.DB_ECONOMY) console.warn("⚠️ AVISO: DB_ECONOMY não está no .env");

const economyConnection = mongoose.createConnection(
    (process.env.DB_ECONOMY as string) || (process.env.DB_RESTANTE as string)
);
economyConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco de Economia'));
economyConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco de Economia:', err));

export { economyConnection };

// ═══════════════════════════════════════════════════════════════════════════════
// CARTEIRA + MOCHILA  (uma por (guildId, ocId) — o dinheiro é do PERSONAGEM,
// isolado por servidor, não da conta Discord)
// ═══════════════════════════════════════════════════════════════════════════════
export interface IWalletItem {
    key: string;    // slug do item (no catálogo, OU do item pessoal)
    qty: number;
    // ─ Itens PESSOAIS (freeform, fora da loja) carregam o próprio nome/emoji ─
    name?: string;  // preenchido só em itens custom (catálogo resolve pelo key)
    emoji?: string;
    custom?: boolean;
}

export interface IWallet extends Document {
    guildId: string;
    ocId: mongoose.Types.ObjectId;  // ref ao OC em OCSchema
    ownerId: string;                // snapshot do adminId (dono do OC) — conveniência
    balance: number;
    items: IWalletItem[];
    lastActivityAt: Date;
    createdAt: Date;
}

const WalletSchema = new Schema<IWallet>({
    guildId: { type: String, required: true, index: true },
    ocId:    { type: Schema.Types.ObjectId, required: true, index: true },
    ownerId: { type: String, required: true },
    balance: { type: Number, default: 0, min: 0 },
    items: [{
        key:    { type: String, required: true },
        qty:    { type: Number, required: true, min: 0 },
        name:   { type: String },   // só em itens pessoais (custom)
        emoji:  { type: String },
        custom: { type: Boolean },
    }],
    lastActivityAt: { type: Date, default: Date.now },
    createdAt:      { type: Date, default: Date.now },
});
// Uma carteira por OC por servidor.
WalletSchema.index({ guildId: 1, ocId: 1 }, { unique: true });

// ═══════════════════════════════════════════════════════════════════════════════
// CATÁLOGO DA LOJA  (itens definidos por servidor)
// ═══════════════════════════════════════════════════════════════════════════════
export interface IItem extends Document {
    guildId: string;
    key: string;          // slug único no servidor (ex: "pocao-de-vida")
    name: string;         // nome exibido (ex: "Poção de Vida")
    emoji: string;
    description: string;
    basePrice: number;    // preço base; na Fase 2 pode ser reajustado pelo índice
    stock: number;        // -1 = ilimitado
    tradable: boolean;    // pode ser transferido entre OCs
    usable: boolean;      // pode ser consumido (use)
    replyOnUse: string;   // texto opcional exibido ao usar
    createdBy: string;
    createdAt: Date;
}

const ItemSchema = new Schema<IItem>({
    guildId:     { type: String, required: true, index: true },
    key:         { type: String, required: true },
    name:        { type: String, required: true },
    emoji:       { type: String, default: '📦' },
    description: { type: String, default: '' },
    basePrice:   { type: Number, default: 0, min: 0 },
    stock:       { type: Number, default: -1 },
    tradable:    { type: Boolean, default: true },
    usable:      { type: Boolean, default: true },
    replyOnUse:  { type: String, default: '' },
    createdBy:   { type: String, default: '' },
    createdAt:   { type: Date, default: Date.now },
});
// Um item por slug por servidor.
ItemSchema.index({ guildId: 1, key: 1 }, { unique: true });

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG ECONÔMICA DO SERVIDOR  (moeda + flags do modo avançado — Fase 2)
// ═══════════════════════════════════════════════════════════════════════════════
export interface IEconomySnapshot {
    at: Date;
    priceIndex: number;
    moneySupply: number;
    realWealth: number;
    velocity: number;
    gdp: number;
}

export interface IGuildEconomy extends Document {
    guildId: string;
    currencyName: string;
    symbol: string;
    // ─ Fase 2 (opt-in) ─
    advanced: boolean;      // liga inflação/PIB/dólar/reajuste
    autoReprice: boolean;   // preços da loja escalam pelo priceIndex
    baseUsdRate: number;    // 1 moeda fictícia = baseUsdRate dólares (no genesis)
    priceIndex: number;     // índice de preço atual (1 = genesis)
    moneySupply: number;    // M cacheado (Σ saldos)
    realWealth: number;     // Q cacheado (Σ valor dos itens em mochilas)
    velocity: number;       // V cacheado (volume/janela ÷ M)
    // ─ Baselines capturados ao ligar o modo avançado (genesis) ─
    genesisMoneySupply: number;
    genesisRealWealth: number;
    genesisVelocity: number;
    advancedSince: Date | null;
    lastRecompute: Date | null;
    history: IEconomySnapshot[]; // série pro gráfico do dashboard
    // ─ Faucets configuráveis ─
    dailyAmount: number;
    workAmount: number;
    createdAt: Date;
}

const GuildEconomySchema = new Schema<IGuildEconomy>({
    guildId:      { type: String, required: true, unique: true },
    currencyName: { type: String, default: 'Moedas' },
    symbol:       { type: String, default: '🪙' },
    advanced:     { type: Boolean, default: false },
    autoReprice:  { type: Boolean, default: false },
    baseUsdRate:  { type: Number, default: 1 },
    priceIndex:   { type: Number, default: 1 },
    moneySupply:  { type: Number, default: 0 },
    realWealth:   { type: Number, default: 0 },
    velocity:     { type: Number, default: 0 },
    genesisMoneySupply: { type: Number, default: 0 },
    genesisRealWealth:  { type: Number, default: 0 },
    genesisVelocity:    { type: Number, default: 0 },
    advancedSince: { type: Date, default: null },
    lastRecompute: { type: Date, default: null },
    history: [{
        at:          { type: Date, default: Date.now },
        priceIndex:  { type: Number, default: 1 },
        moneySupply: { type: Number, default: 0 },
        realWealth:  { type: Number, default: 0 },
        velocity:    { type: Number, default: 0 },
        gdp:         { type: Number, default: 0 },
    }],
    dailyAmount:  { type: Number, default: 250 },
    workAmount:   { type: Number, default: 50 },
    createdAt:    { type: Date, default: Date.now },
});

// ═══════════════════════════════════════════════════════════════════════════════
// LEDGER DE TRANSAÇÕES  (efêmero, TTL 30d — alimenta velocidade da moeda + PIB)
// ═══════════════════════════════════════════════════════════════════════════════
export type LedgerType = 'transfer' | 'buy' | 'sell' | 'faucet' | 'sink';

export interface ILedger extends Document {
    guildId: string;
    type: LedgerType;
    amount: number;
    createdAt: Date;
}

const LedgerSchema = new Schema<ILedger>({
    guildId:   { type: String, required: true, index: true },
    type:      { type: String, required: true },
    amount:    { type: Number, required: true },
    // ⚡ TTL — o MongoDB apaga sozinho 30 dias após criação.
    createdAt: { type: Date, default: Date.now, expires: '30d' },
});

// ─── Exports ───────────────────────────────────────────────────────────────────
export const WalletModel        = economyConnection.model<IWallet>('Wallet', WalletSchema);
export const ItemModel          = economyConnection.model<IItem>('EconomyItem', ItemSchema);
export const GuildEconomyModel  = economyConnection.model<IGuildEconomy>('GuildEconomy', GuildEconomySchema);
export const EconomyLedgerModel = economyConnection.model<ILedger>('EconomyLedger', LedgerSchema);
