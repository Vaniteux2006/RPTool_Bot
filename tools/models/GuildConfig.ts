import { getConnection } from '../database';
import mongoose, { Schema, Document } from 'mongoose';

const configConnection = getConnection(process.env.DB_RESTANTE as string, 'Geral');

export interface IGuildConfig extends Document {
    guildId: string;
    logChannelId: string;
    isLoggingEnabled: boolean; 
}

const GuildConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    logChannelId: { type: String, required: true },
    isLoggingEnabled: { type: Boolean, default: true } // <-- Por padrão, vem ligado
});

export const GuildConfigModel = configConnection.models.GuildConfig || configConnection.model<IGuildConfig>('GuildConfig', GuildConfigSchema);