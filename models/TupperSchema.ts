// models/TupperSchema.ts
import mongoose, { Schema, Document } from 'mongoose';
import { tupperConnection } from '../database'; // <--- A conexão separada

export interface ITupper extends Document {
    adminId: string;        // Dono original
    duoIds: string[];       // Pessoas com acesso "duo"
    name: string;           // Nome único para o usuário
    prefix: string;         // Parte inicial do bracket
    suffix: string;         // Parte final do bracket
    avatar: string;
    group: string | null;   // Nome do grupo (ou null)
    messageCount: number;   // Contador de mensagens
    createdAt: Date;        // Data de criação (aniversário padrão)
    realBirthday: Date | null; // Aniversário manual (rp!birthday)
    
    // Configurações de IA
    ai: {
        enabled: boolean;
        persona: string;
        activeChannelId: string | null; // Onde o bot está "ouvindo"
        memories: { id: string, content: string }[]; // Memórias de longo prazo
    };
}

const TupperSchema = new Schema({
    adminId: { type: String, required: true, index: true },
    duoIds: { type: [String], default: [] },
    name: { type: String, required: true },
    prefix: { type: String, default: "" },
    suffix: { type: String, default: "" },
    avatar: { type: String, required: true },
    group: { type: String, default: null },
    messageCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    realBirthday: { type: Date, default: null },

    ai: {
        enabled: { type: Boolean, default: false },
        persona: { type: String, default: "" },
        activeChannelId: { type: String, default: null },
        memories: [{
            id: String,
            content: String
        }]
    }
});

// Índice composto: Um usuário não pode ter dois tuppers com mesmo nome
TupperSchema.index({ adminId: 1, name: 1 }, { unique: true });

export const TupperModel = tupperConnection.model<ITupper>('Tupper', TupperSchema);