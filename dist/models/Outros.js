"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneRegistryModel = exports.WikiArticleModel = exports.BotStatusModel = exports.WelcomeModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
require("dotenv/config");
const restanteConnection = mongoose_1.default.createConnection(process.env.DB_RESTANTE);
restanteConnection.on('connected', () => {
    console.log('✅ [MongoDB] Conectado ao banco Restante (Sistemas Gerais)');
});
const BotStatusSchema = new mongoose_1.default.Schema({
    content: { type: String, required: true },
    type: { type: String, required: true }
});
const WikiArticleSchema = new mongoose_1.default.Schema({
    title: { type: String, required: true, unique: true },
    paragraphs: { type: [String], required: true }
});
const PhoneRegistrySchema = new mongoose_1.default.Schema({
    serverId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    marker: { type: String, default: null }
});
const WelcomeSchema = new mongoose_1.default.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, default: null },
    joinMsg: { type: String, default: "🎉 Bem-vindo(a) {user} ao servidor **{server}**! Agora somos {count} membros." },
    leaveMsg: { type: String, default: "🚶 {user} arrumou as malas e saiu do servidor." },
    kickMsg: { type: String, default: "👟 {user} foi expulso(a) do servidor a pontapés!" },
    banMsg: { type: String, default: "🔨 {user} tomou o martelo do ban e não volta mais." }
});
exports.WelcomeModel = restanteConnection.model('WelcomeConfig', WelcomeSchema);
exports.BotStatusModel = restanteConnection.model('BotStatus', BotStatusSchema);
exports.WikiArticleModel = restanteConnection.model('WikiArticle', WikiArticleSchema);
exports.PhoneRegistryModel = restanteConnection.model('PhoneRegistry', PhoneRegistrySchema);
