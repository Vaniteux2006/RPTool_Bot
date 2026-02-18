"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainConnection = exports.tupperConnection = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (!process.env.DB_TUPPER)
    console.warn("⚠️ AVISO: DB_TUPPER não está no .env");
if (!process.env.DB_RESTANTE)
    console.warn("⚠️ AVISO: DB_RESTANTE não está no .env");
const tupperConnection = mongoose_1.default.createConnection(process.env.DB_TUPPER);
exports.tupperConnection = tupperConnection;
tupperConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco de Tuppers'));
tupperConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco Tupper:', err));
const mainConnection = mongoose_1.default.createConnection(process.env.DB_RESTANTE || process.env.DB_TUPPER);
exports.mainConnection = mainConnection;
mainConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco Geral'));
