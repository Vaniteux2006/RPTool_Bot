import mongoose, { Schema, Document } from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const restanteConnection = mongoose.createConnection(process.env.DB_RESTANTE as string);

export interface ITokenKey {
    id: string;
    name: string;
    provider: 'gemini' | 'openai';
    value: string;
    model: string;
}

export interface ITokenUser extends Document {
    userId: string;
    keys: ITokenKey[];
    assignments: { guildId: string; keyId: string }[];
}

const TokenSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    keys: { type: Array, default: [] },
    assignments: { type: Array, default: [] }
});

export const TokenModel = restanteConnection.model<ITokenUser>('Token', TokenSchema);