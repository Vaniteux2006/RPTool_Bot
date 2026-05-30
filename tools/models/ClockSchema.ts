// RPTool/tools/models/ClockSchema.ts
// Schema compartilhado pelos supercommands /tempo e /clima
import { Schema, Document } from 'mongoose';
import { mainConnection } from '../database';

export interface IClock extends Document {
    name: string;           // Identificador único (ex: "Seattle", "AUTO_<channelId>")
    channelId: string;      // Canal onde a mensagem do relógio fica fixada
    messageId: string;      // ID da mensagem que é editada pelo engine
    guildId: string;        // Guild de origem (para CRUD por servidor)

    // ─── Âncoras de tempo ────────────────────────────────────────────────────
    anchorReal: number;     // Timestamp real (ms) no momento da última calibração
    anchorRPG: number;      // Timestamp RP (ms) correspondente àquela calibração

    // ─── Modificadores ───────────────────────────────────────────────────────
    velocity: number;       // Multiplicador: quanto tempo RP passa por ms real
                            //   1 = tempo real, 2 = 2x mais rápido, 0.5 = metade
    dilation: number;       // Desvio cosmológico (para Sci-Fi): afeta exibição do
                            //   "tempo terrestre" vs tempo do local RP

    // ─── Localização (para clima automático) ─────────────────────────────────
    latitude:  number | null;
    longitude: number | null;
    locationName: string | null;   // Nome legível (ex: "Seattle, United States")

    // ─── Clima forçado (override manual pelo ADM) ────────────────────────────
    forcedWeather: string | null;  // null = automático; string = texto exibido
                                   // Se for um código WMO padrão → condição normal
                                   // Se for texto livre → Anomalia 🚫

    // ─── Configuração visual ──────────────────────────────────────────────────
    timezone: string;              // Fuso para formatação de hora (padrão: 'UTC')
    paused: boolean;               // Se true, o engine não edita a mensagem
}

const ClockSchema = new Schema<IClock>({
    name:         { type: String, required: true, unique: true },
    channelId:    { type: String, required: true },
    messageId:    { type: String, required: true },
    guildId:      { type: String, required: true, index: true },

    anchorReal:   { type: Number, required: true },
    anchorRPG:    { type: Number, required: true },

    velocity:     { type: Number, default: 1 },
    dilation:     { type: Number, default: 1 },

    latitude:     { type: Number, default: null },
    longitude:    { type: Number, default: null },
    locationName: { type: String, default: null },

    forcedWeather: { type: String, default: null },

    timezone:     { type: String, default: 'UTC' },
    paused:       { type: Boolean, default: false },
});

// Garante idempotência: se o model já existe, reutiliza
export const ClockModel = mainConnection.models['Clock']
    ?? mainConnection.model<IClock>('Clock', ClockSchema);