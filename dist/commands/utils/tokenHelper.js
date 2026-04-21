"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGuildAIConfig = getGuildAIConfig;
const TokenSchema_1 = require("../../models/TokenSchema");
// 🌟 Atenção: Agora a função é ASSÍNCRONA (async)
async function getGuildAIConfig(guildId) {
    if (!guildId)
        return fallbackEnv();
    try {
        // Procura alguém que tenha configurado uma chave para este servidor
        const user = await TokenSchema_1.TokenModel.findOne({ "assignments.guildId": guildId });
        if (user) {
            const assignment = user.assignments.find(a => a.guildId === guildId);
            if (assignment) {
                const keyData = user.keys.find(k => k.id === assignment.keyId);
                if (keyData) {
                    return {
                        provider: keyData.provider,
                        key: keyData.value,
                        model: keyData.model
                    };
                }
            }
        }
    }
    catch (e) {
        console.error("Erro ao buscar token no MongoDB:", e);
    }
    return fallbackEnv();
}
function fallbackEnv() {
    // Se ninguém configurou, tenta usar o global do .env
    if (process.env.GEMINI_API_KEY) {
        return {
            provider: 'gemini',
            key: process.env.GEMINI_API_KEY,
            model: 'gemini-3-flash-preview'
        };
    }
    return undefined;
}
