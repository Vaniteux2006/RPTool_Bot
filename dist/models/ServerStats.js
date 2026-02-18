"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockedWordsModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
require("dotenv/config");
const statusConnection = mongoose_1.default.createConnection(process.env.DB_STATUS);
statusConnection.on('connected', () => {
    console.log('✅ [MongoDB] Conectado ao banco de Status');
});
statusConnection.on('error', (err) => {
    console.error('❌ [MongoDB] Erro ao conectar no banco de Status:', err);
});
const statSchema = new mongoose_1.default.Schema({
    guildId: { type: String, required: true },
    date: { type: String, required: true },
    hour: { type: Number, required: true },
    total: { type: Number, default: 0 },
    users: { type: Map, of: Number, default: {} },
    channels: { type: Map, of: Number, default: {} },
    words: { type: Map, of: Number, default: {} }
});
statSchema.index({ guildId: 1, date: 1, hour: 1 }, { unique: true });
const BlockedWordsSchema = new mongoose_1.default.Schema({
    guildId: { type: String, required: true, unique: true },
    words: { type: [String], default: [] }
});
exports.BlockedWordsModel = statusConnection.model('BlockedWords', BlockedWordsSchema);
exports.default = statusConnection.model('ServerStats', statSchema);
