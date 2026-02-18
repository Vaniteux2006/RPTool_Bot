import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { AIConfig } from './commands/utils/tokenHelper';

class RPToolAPI {
    
    constructor() {
        console.log("🚀 [API HÍBRIDA] Sistema de IA inicializado.");
    }

    async chat(npcName: string, persona: string, userMessage: string, config?: AIConfig): Promise<string> {
        if (!config) return "❌ Erro: Nenhum token configurado para este servidor.";

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
            } else {
                return await this.generateGemini(config, systemPrompt);
            }
        } catch (e: any) {
            console.error("Erro API:", e.message);
            return `// ❌ Erro na IA (${config.provider}): ${e.message || "Erro desconhecido."}`;
        }
    }

    async generateRaw(prompt: string, config?: AIConfig): Promise<string> {
        if (!config) throw new Error("Sem configuração de IA.");

        try {
            if (config.provider === 'openai') {
                return await this.generateOpenAI(config, prompt);
            } else {
                return await this.generateGemini(config, prompt);
            }
        } catch (e) {
            throw e;
        }
    }

    private async generateGemini(config: AIConfig, prompt: string): Promise<string> {
        const genAI = new GoogleGenerativeAI(config.key);
        const model = genAI.getGenerativeModel({
            model: config.model, 
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        });

        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    private async generateOpenAI(config: AIConfig, prompt: string): Promise<string> {
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

        const data: any = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.choices[0].message.content;
    }
}

export const api = new RPToolAPI();