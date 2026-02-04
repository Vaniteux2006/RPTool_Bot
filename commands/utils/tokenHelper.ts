import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../../Data');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

// Interface nova para suportar configuração completa
export interface AIConfig {
    provider: 'gemini' | 'openai';
    key: string;
    model: string;
}

export function getGuildAIConfig(guildId: string | null): AIConfig | undefined {
    // Tenta carregar do arquivo primeiro
    if (fs.existsSync(TOKENS_FILE)) {
        try {
            const db = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
            
            // Procura alguém que tenha liberado token para este servidor
            const validUser = db.tokens.find((t: any) => 
                t.allowed_guilds.includes(guildId) && t.key && t.model
            );
            
            if (validUser) {
                return {
                    provider: validUser.provider || 'gemini', // Default para gemini se antigo
                    key: validUser.key,
                    model: validUser.model
                };
            }
        } catch (e) {
            console.error("Erro ao ler tokens.json", e);
        }
    }

    // Fallback: Se não achou token de usuário, usa o do .env (Se existir)
    // Aqui assumimos que o .env é sempre Gemini e usamos um modelo padrão seguro
    if (process.env.GEMINI_API_KEY) {
        return {
            provider: 'gemini',
            key: process.env.GEMINI_API_KEY,
            model: 'gemini-3-flash-preview' // Modelo padrão do sistema
        };
    }

    return undefined;
}