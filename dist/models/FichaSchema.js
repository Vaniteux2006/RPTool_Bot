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
exports.FichaModel = exports.TemplateModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const fichaConnection = mongoose_1.default.createConnection(process.env.DB_FICHA);
const TemplateSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true },
    rawText: { type: String, required: true },
    fields: { type: Array, default: [] },
    checkChannelId: { type: String, default: null },
    hallChannelId: { type: String, default: null },
    ocIntegration: { type: Boolean, default: false },
    ocPrefixLabel: { type: String, default: null }
});
const FichaSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    characterName: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved"], default: "pending" },
    data: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    avatar: { type: String, default: "" },
    hallMessageId: { type: String, default: null }
});
exports.TemplateModel = fichaConnection.model('Template', TemplateSchema);
exports.FichaModel = fichaConnection.model('Ficha', FichaSchema);
