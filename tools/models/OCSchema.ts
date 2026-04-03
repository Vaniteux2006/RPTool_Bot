import mongoose, { Schema, Document } from 'mongoose';
import { OCConnection, WikiConnection } from '../database';

// --- INTERFACE DO OC (Dados Leves - DB_OC) ---
export interface IOC extends Document {
    adminId: string;
    duoIds: string[];
    name: string;
    prefix: string;
    suffix: string;
    avatar: string;
    group: string | null;
    messageCount: number;
    createdAt: Date;
    realBirthday: Date | null;
    ai: {
        enabled: boolean;
        persona: string;
        activeChannelId: string | null;
        autoMode: boolean;
        replyDelay: number;
        memories: { id: string, content: string }[];
    };
}

// --- INTERFACE DA WIKI (Dados Pesados - DB_OC_WIKI) ---
export interface IWiki extends Document {
    ocId: mongoose.Types.ObjectId; 
    adminId: string;
    bio: string;
    extras: Map<string, string>;
    sections: { title: string, content: string, emoji?: string }[];
    references: string[];
    gallery: {
        category: string;
        images: string[];
    }[];
}

// --- SCHEMA DO OC ---
const OCSchema = new Schema({
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
        autoMode: { type: Boolean, default: false },
        replyDelay: { type: Number, default: 30 },
        memories: [{ id: String, content: String }]
    }
});

// --- SCHEMA DA WIKI ---
const WikiSchema = new Schema({
    ocId: { type: Schema.Types.ObjectId, required: true, index: true },
    adminId: { type: String, required: true },
    bio: { type: String, default: "" },
    extras: { type: Map, of: String, default: {} },
    sections: [{
        title: { type: String, required: true },
        content: { type: String, required: true },
        emoji: { type: String, default: '📄' }
    }],
    references: { type: [String], default: [] },
    gallery: [{
        category: { type: String },
        images: { type: [String], default: [] }
    }]
});

// Exportação dos Modelos vinculados às conexões corretas
export const OCModel = OCConnection.model<IOC>('OC', OCSchema);
export const WikiModel = WikiConnection.model<IWiki>('Wiki', WikiSchema);