// RPTool/tools/models/CensuraConfig.ts
// ─── Schema do MongoDB para o filtro de censura (rp!censura) ──────────────────
import { Schema, Document, Model } from 'mongoose';
import { mainConnection } from '../database';

export interface ICensuraConfig extends Document {
    guildId:         string;
    enabled:         boolean;
    // Termos adicionados pela staff além da lista padrão (minúsculas, podem ter espaços)
    extraWords:      string[];
    // Termos da lista PADRÃO desativados neste servidor (ex: "rola", "pau")
    disabledWords:   string[];
    // Canais (ou canais-pai de threads) onde o filtro não age
    ignoredChannels: string[];
    updatedAt:       Date;
}

const CensuraConfigSchema = new Schema<ICensuraConfig>({
    guildId:         { type: String, required: true, unique: true, index: true },
    enabled:         { type: Boolean, default: false },
    extraWords:      { type: [String], default: [] },
    disabledWords:   { type: [String], default: [] },
    ignoredChannels: { type: [String], default: [] },
}, {
    timestamps: true,
});

export const CensuraConfigModel: Model<ICensuraConfig> =
    mainConnection.models.CensuraConfig as Model<ICensuraConfig>
    ?? mainConnection.model<ICensuraConfig>('CensuraConfig', CensuraConfigSchema);
