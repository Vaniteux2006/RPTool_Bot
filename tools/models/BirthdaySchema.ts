import mongoose, { Schema, Document } from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const restanteConnection = mongoose.createConnection(process.env.DB_RESTANTE as string);

export interface IBirthday extends Document {
    guildId: string;
    identifier: string; 
    isUser: boolean;   
    day: number;
    month: number;
    year?: number;
}

const BirthdaySchema = new Schema({
    guildId: { type: String, required: true },
    identifier: { type: String, required: true },
    isUser: { type: Boolean, default: false },
    day: { type: Number, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: false }
});

BirthdaySchema.index({ guildId: 1, identifier: 1 }, { unique: true });

export interface IBirthdayConfig extends Document {
    guildId: string;
    channelId: string;
    messageId: string;
}

const BirthdayConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true }
});

export const BirthdayModel = restanteConnection.model<IBirthday>('Birthday', BirthdaySchema);
export const BirthdayConfigModel = restanteConnection.model<IBirthdayConfig>('BirthdayConfig', BirthdayConfigSchema);