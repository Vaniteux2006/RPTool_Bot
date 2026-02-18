import mongoose, { Schema, Document } from 'mongoose';
import { tupperConnection } from '../database';

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

    wiki: {
        bio: string;
        extras: Map<string, string>; 
        sections: { title: string, content: string, emoji?: string }[];
        references: string[]; 
    };
}

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
        memories: [{
            id: String,
            content: String
        }]
    },

    wiki: {
        bio: { type: String, default: "" },
        extras: { type: Map, of: String, default: {} },
        sections: [{
            title: { type: String, required: true },
            content: { type: String, required: true }, 
            emoji: { type: String, default: '📄' }
        }],
        references: { type: [String], default: [] }
    }
});

OCSchema.index({ adminId: 1, name: 1 }, { unique: true });

export const OCModel = tupperConnection.model<IOC>('OC', OCSchema, 'tuppers');