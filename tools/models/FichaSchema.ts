import mongoose, { Schema, Document } from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const fichaConnection = mongoose.createConnection(process.env.DB_FICHA as string);

export interface ITemplate extends Document {
    guildId: string;
    rawText: string;
    fields: any[];
    checkChannelId: string | null;
    hallChannelId: string | null;
    ocIntegration: boolean;
    ocPrefixLabel: string | null;
}

const TemplateSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    rawText: { type: String, required: true },
    fields: { type: Array, default: [] },
    checkChannelId: { type: String, default: null },
    hallChannelId: { type: String, default: null },
    ocIntegration: { type: Boolean, default: false },
    ocPrefixLabel: { type: String, default: null }
});

export interface IFicha extends Document {
    guildId: string;
    userId: string;
    characterName: string;
    status: "pending" | "approved";
    data: Record<string, any>; 
    avatar: string;
    hallMessageId: string | null;
}

const FichaSchema = new Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    characterName: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved"], default: "pending" },
    data: { type: Schema.Types.Mixed, default: {} },
    avatar: { type: String, default: "" },
    hallMessageId: { type: String, default: null }
});

export const TemplateModel = fichaConnection.model<ITemplate>('Template', TemplateSchema);
export const FichaModel = fichaConnection.model<IFicha>('Ficha', FichaSchema);