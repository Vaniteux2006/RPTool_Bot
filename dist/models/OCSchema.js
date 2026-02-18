"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OCModel = void 0;
const mongoose_1 = require("mongoose");
const database_1 = require("../database");
const OCSchema = new mongoose_1.Schema({
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
exports.OCModel = database_1.tupperConnection.model('OC', OCSchema, 'tuppers');
