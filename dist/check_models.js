"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
async function listGoogleModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ ERRO: GEMINI_API_KEY não encontrada no .env");
        return;
    }
    console.log("📡 Perguntando ao Google: 'O que eu posso usar?'...\n");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        if (data.error) {
            console.error(`❌ Erro do Google: ${data.error.message}`);
            return;
        }
        if (!data.models || data.models.length === 0) {
            console.log("⚠️ O Google respondeu, mas a lista de modelos veio vazia.");
            return;
        }
        console.log("✅ Lista Oficial de Modelos Disponíveis para sua Chave:");
        console.log("======================================================");
        data.models.forEach((model) => {
            const capabilities = model.supportedGenerationMethods.join(", ");
            console.log(`📦 NOME: ${model.name.replace('models/', '')}`);
        });
    }
    catch (error) {
        console.error("🔥 Erro fatal ao conectar:", error);
    }
}
listGoogleModels();
