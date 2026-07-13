// RPTool/tools/models/LockdownConfig.ts
// ─── Schema do MongoDB para o modo lockdown (rp!lockdown) ─────────────────────
import { Schema, Document, Model } from 'mongoose';
import { mainConnection } from '../database';

// Snapshot do overwrite do @everyone em um canal ANTES do lockdown.
// Bitfields de permissão são BigInt no discord.js → armazenados como string.
export interface ILockdownSnapshot {
    channelId:    string;
    hadOverwrite: boolean; // false = @everyone não tinha overwrite neste canal
    allow:        string;
    deny:         string;
}

export interface ILockdownConfig extends Document {
    guildId:       string;
    active:        boolean;
    bypassRoleId:  string;
    // Estado pré-lockdown de cada canal trancado — rp!lockdown off restaura EXATAMENTE isto
    snapshots:     ILockdownSnapshot[];
    // Canais liberados via rp!lockdown free (continuam no snapshots pro off final)
    freedChannels: string[];
    startedBy:     string;
    updatedAt:     Date;
}

const SnapshotSchema = new Schema<ILockdownSnapshot>({
    channelId:    { type: String, required: true },
    hadOverwrite: { type: Boolean, default: false },
    allow:        { type: String, default: '0' },
    deny:         { type: String, default: '0' },
}, { _id: false });

const LockdownConfigSchema = new Schema<ILockdownConfig>({
    guildId:       { type: String, required: true, unique: true, index: true },
    active:        { type: Boolean, default: false },
    bypassRoleId:  { type: String, default: '' },
    snapshots:     { type: [SnapshotSchema], default: [] },
    freedChannels: { type: [String], default: [] },
    startedBy:     { type: String, default: '' },
}, {
    timestamps: true,
});

export const LockdownConfigModel: Model<ILockdownConfig> =
    mainConnection.models.LockdownConfig as Model<ILockdownConfig>
    ?? mainConnection.model<ILockdownConfig>('LockdownConfig', LockdownConfigSchema);
