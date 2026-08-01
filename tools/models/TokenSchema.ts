import mongoose, { Schema, Document } from 'mongoose';
import { getConnection } from '../database';
import * as dotenv from 'dotenv';
dotenv.config();

const restanteConnection = getConnection(process.env.DB_RESTANTE as string, 'Geral');

export interface ITokenKey {
    id: string;
    name: string;
    provider: 'gemini' | 'openai';
    value: string;
    model: string;
}

export interface ITokenAssignment {
    guildId: string;
    keyId: string;
}

export interface ITokenUser extends Document {
    userId: string;
    keys: ITokenKey[];
    assignments: ITokenAssignment[];
}

// Subdocumentos tipados (_id:false mantém a forma compatível com os dados já gravados)
const KeySchema = new Schema<ITokenKey>({
    id:       { type: String, required: true },
    name:     { type: String, default: '' },
    provider: { type: String, enum: ['gemini', 'openai'], required: true },
    value:    { type: String, required: true },
    model:    { type: String, default: '' },
}, { _id: false });

const AssignmentSchema = new Schema<ITokenAssignment>({
    guildId: { type: String, required: true },
    keyId:   { type: String, required: true },
}, { _id: false });

const TokenSchema = new Schema<ITokenUser>({
    userId:      { type: String, required: true, unique: true },
    keys:        { type: [KeySchema], default: [] },
    assignments: { type: [AssignmentSchema], default: [] },
});

export const TokenModel = restanteConnection.model<ITokenUser>('Token', TokenSchema);
