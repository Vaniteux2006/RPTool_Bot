// RPTool/tools/models/LogConfig.ts
// ─── Schema do MongoDB para configuração de logs ──────────────────────────────
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILogConfig extends Document {
    guildId:    string;
    channelId:  string | null;
    enabled:    boolean;
    categories: Record<string, boolean>;
    updatedAt:  Date;
}

const LogConfigSchema = new Schema<ILogConfig>({
    guildId:   { type: String, required: true, unique: true, index: true },
    channelId: { type: String, default: null },
    enabled:   { type: Boolean, default: false },
    // categories: cada chave é uma LogCategory, valor true/false
    // padrão implícito: ausente = ativo (ver LogMinister.allows())
    categories: { type: Map, of: Boolean, default: {} },
}, {
    timestamps: true, // adiciona createdAt e updatedAt automaticamente
});

export const LogModel: Model<ILogConfig> =
    mongoose.models.LogConfig as Model<ILogConfig>
    ?? mongoose.model<ILogConfig>('LogConfig', LogConfigSchema);
