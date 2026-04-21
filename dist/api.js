"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const generative_ai_1 = require("@google/generative-ai");
class RPToolAPI {
    constructor() {
        console.log("🚀 [API HÍBRIDA] Sistema de IA inicializado.");
    }
    async chat(npcName, persona, userMessage, config) {
        if (!config)
            return "❌ Erro: Nenhum token configurado para este servidor.";
        const systemPrompt = `
        [INSTRUÇÃO DO SISTEMA]
        ${persona}
        [CONTEXTO]
        Responda como ${npcName}. Seja imersivo.
        [USUÁRIO]: ${userMessage}
        [${npcName}]:
        `;
        try {
            if (config.provider === 'openai') {
                return await this.generateOpenAI(config, systemPrompt);
            }
            else {
                return await this.generateGemini(config, systemPrompt);
            }
        }
        catch (e) {
            console.error("Erro API:", e.message);
            return `// ❌ Erro na IA (${config.provider}): ${e.message || "Erro desconhecido."}`;
        }
    }
    async generateRaw(prompt, config) {
        if (!config)
            throw new Error("Sem configuração de IA.");
        try {
            if (config.provider === 'openai') {
                return await this.generateOpenAI(config, prompt);
            }
            else {
                return await this.generateGemini(config, prompt);
            }
        }
        catch (e) {
            throw e;
        }
    }
    async generateGemini(config, prompt) {
        const genAI = new generative_ai_1.GoogleGenerativeAI(config.key);
        const model = genAI.getGenerativeModel({
            model: config.model,
            safetySettings: [
                { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
                { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
                { category: generative_ai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
                { category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
            ]
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
    }
    async generateOpenAI(config, prompt) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.8
            })
        });
        const data = await response.json();
        if (data.error)
            throw new Error(data.error.message);
        return data.choices[0].message.content;
    }
}
exports.api = new RPToolAPI();
