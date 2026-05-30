"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBlockedWords = loadBlockedWords;
exports.default = trackMessage;
const ServerStats_1 = __importStar(require("../models/ServerStats"));
const blockedWordsCache = new Map();
async function loadBlockedWords(guildId) {
    const doc = await ServerStats_1.BlockedWordsModel.findOne({ guildId });
    if (doc) {
        blockedWordsCache.set(guildId, new Set(doc.words));
    }
    else {
        blockedWordsCache.set(guildId, new Set());
    }
    return blockedWordsCache.get(guildId);
}
async function trackMessage(message) {
    if (!message.guild || message.author.bot || message.content.startsWith('rp!'))
        return;
    const guildId = message.guild.id;
    const userId = message.author.id;
    const channelId = message.channel.id;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const hour = now.getHours();
    const rawWords = message.content.toLowerCase().match(/\b[\wáéíóúâêôãõçü]{3,}\b/g) || [];
    let blocklist = blockedWordsCache.get(guildId);
    if (!blocklist) {
        blocklist = await loadBlockedWords(guildId);
    }
    const validWords = rawWords.filter(w => !blocklist.has(w) &&
        !w.includes('http') &&
        !w.includes('tenor') &&
        !w.includes('https'));
    const incData = { total: 1 };
    incData[`users.${userId}`] = 1;
    incData[`channels.${channelId}`] = 1;
    for (const word of validWords) {
        incData[`words.${word}`] = 1;
    }
    try {
        await ServerStats_1.default.findOneAndUpdate({ guildId, date: dateStr, hour }, { $inc: incData }, { upsert: true, setDefaultsOnInsert: true });
    }
    catch (e) {
        console.error("Erro ao salvar estatísticas no MongoDB:", e);
    }
}
