import { 
    Message, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ComponentType,
    User 
} from 'discord.js';
import fs from 'fs';
import path from 'path';

// --- TIPOS ---

const DATA_DIR = path.join(__dirname, '../Data');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

interface UserTokenData {
    userId: string;
    username: string;
    provider: 'gemini' | 'openai';
    key: string;
    model: string;
    allowed_guilds: string[];
}

interface TokenDatabase {
    tokens: UserTokenData[];
}

export default {
    name: 'token',
    description: 'Gerencia tokens de IA (Gemini/GPT)',

    // --- BANCO DE DADOS ---

    loadTokens(): TokenDatabase {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (!fs.existsSync(TOKENS_FILE)) return { tokens: [] };
        try {
            return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
        } catch (e) { return { tokens: [] }; }
    },

    saveTokens(data: TokenDatabase) {
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 4));
    },

    // --- COMANDO PRINCIPAL ---

    async execute(message: Message, args: string[]) {
        const subCmd = args[0]?.toLowerCase();
        const db = this.loadTokens();
        const userData = db.tokens.find(t => t.userId === message.author.id);

        // 1. Fluxo de Registro / Setup
        if (!subCmd) {
            // VERIFICAÇÃO PRÉVIA (O que você pediu)
            if (userData) {
                const guildId = message.guild?.id;
                const isAllowedHere = guildId && userData.allowed_guilds.includes(guildId);
                
                let statusMsg = `🔍 **Você já possui um token registrado!**\nModelo: \`${userData.model}\` (${userData.provider})`;

                if (guildId) {
                    statusMsg += isAllowedHere 
                        ? `\n✅ E ele já está **ATIVO** neste servidor.`
                        : `\n⚠️ Mas ele **NÃO** está ativo neste servidor (use \`rp!token on\` para ativar).`;
                }

                message.reply(`${statusMsg}\n\n📨 Verifique seu PV se quiser **alterar** a chave/modelo.`);
            } else {
                message.reply("📩 **Verifique seu PV!** Iniciei o assistente de configuração.");
            }

            return this.startRegistrationFlow(message, userData); // Passa os dados antigos se tiver
        }

        // 2. Comandos de Gerenciamento
        if (!userData) return message.reply("⚠️ Você não tem token configurado. Use `rp!token` primeiro.");

        switch (subCmd) {
            case 'info': case 'set':
                this.handleInfo(message, userData);
                break;
            case 'on':
                this.handleToggle(message, args, userData, db, true);
                break;
            case 'off':
                this.handleToggle(message, args, userData, db, false);
                break;
            default:
                message.reply("❌ Use: `rp!token` (setup), `set` (info), `on <id>`, `off <id>`.");
        }
    },

    // --- FLUXO DE REGISTRO INTELIGENTE ---

    async startRegistrationFlow(message: Message, existingData?: UserTokenData) {
        try {
            const dm = await message.author.createDM();
            
            const embed = new EmbedBuilder()
                .setTitle("🔑 Configuração de IA")
                .setColor(0x0099FF);

            if (existingData) {
                embed.setDescription(`⚠️ **ATENÇÃO:** Você já tem uma chave configurada para o modelo **${existingData.model}**.\n\nPara **MANTER** a atual, digite \`cancelar\`.\nPara **SUBSTITUIR**, envie a nova API Key abaixo.`);
            } else {
                embed.setDescription(`Envie sua API Key abaixo.\n\n✅ **Google Gemini** (Começa com 'AIza')\n✅ **OpenAI GPT** (Começa com 'sk-')\n\nEu vou detectar automaticamente.`);
            }

            await dm.send({ embeds: [embed] });

            const collector = dm.createMessageCollector({ max: 1, time: 120000 });

            collector.on('collect', async (m) => {
                if (m.content.toLowerCase() === 'cancelar') {
                    await dm.send("👍 Operação cancelada. Seus dados antigos foram mantidos.");
                    return;
                }

                const key = m.content.trim();
                let provider: 'gemini' | 'openai' | null = null;

                if (key.startsWith('AIza')) provider = 'gemini';
                else if (key.startsWith('sk-')) provider = 'openai';

                if (!provider) {
                    await dm.send("⚠️ Token não reconhecido. Certifique-se que é do Google ou OpenAI.");
                    return;
                }

                await dm.send(`🔎 Detectei **${provider.toUpperCase()}**. Buscando modelos...`);

                const models = await this.fetchModels(provider, key);
                
                if (models.length === 0) {
                    await dm.send("❌ Chave inválida ou sem modelos disponíveis.");
                    return;
                }

                // Menu de Seleção
                const options = models.slice(0, 25).map((mod: string) => ({
                    label: mod,
                    value: mod,
                    description: `Modelo ${mod}`
                }));

                const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                    .addComponents(new StringSelectMenuBuilder()
                        .setCustomId('select_model')
                        .setPlaceholder('Selecione o Modelo')
                        .addOptions(options));

                const selectMsg = await dm.send({
                    content: "📋 **Escolha o modelo:**",
                    components: [row]
                });

                try {
                    const selection = await selectMsg.awaitMessageComponent({ 
                        componentType: ComponentType.StringSelect, 
                        time: 60000 
                    });

                    const selectedModel = selection.values[0];
                    
                    // SALVA TUDO
                    this.saveUserData(message.author, provider, key, selectedModel, message.guild?.id);
                    
                    await selection.update({ 
                        content: `✅ **Sucesso!**\nProvedor: ${provider}\nModelo: \`${selectedModel}\`\n\nVolte ao servidor e use \`rp!token set\` se precisar gerenciar permissões.`, 
                        components: [] 
                    });

                } catch (err) {
                    await dm.send("⏱️ Tempo esgotado.");
                }
            });

        } catch (error) {
            message.reply("❌ Não consegui enviar DM. Verifique se seu PV está aberto.");
        }
    },

    // --- UTILITÁRIOS E HELPERS ---

    async fetchModels(provider: 'gemini' | 'openai', key: string): Promise<string[]> {
        try {
            if (provider === 'gemini') {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                const data = await res.json();
                if (!data.models) return [];
                return data.models
                    .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
                    .map((m: any) => m.name.replace('models/', ''));
            } 
            else if (provider === 'openai') {
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                const data = await res.json();
                if (!data.data) return [];
                return data.data
                    .filter((m: any) => m.id.includes('gpt'))
                    .map((m: any) => m.id);
            }
            return [];
        } catch (e) { return []; }
    },

    saveUserData(user: User, provider: 'gemini'|'openai', key: string, model: string, currentGuildId?: string) {
        const db = this.loadTokens();
        let userData = db.tokens.find(t => t.userId === user.id);

        if (!userData) {
            userData = {
                userId: user.id,
                username: user.username,
                provider, key, model,
                allowed_guilds: []
            };
            db.tokens.push(userData);
        } else {
            userData.provider = provider;
            userData.key = key;
            userData.model = model;
        }

        if (currentGuildId && !userData.allowed_guilds.includes(currentGuildId)) {
            userData.allowed_guilds.push(currentGuildId);
        }

        this.saveTokens(db);
    },

    handleInfo(message: Message, data: UserTokenData) {
        const guildList = data.allowed_guilds.map(id => `• \`${id}\``).join('\n') || "Nenhum.";
        const embed = new EmbedBuilder()
            .setTitle("⚙️ Suas Configurações")
            .setColor(0x00FF00)
            .addFields(
                { name: 'Provedor', value: data.provider.toUpperCase(), inline: true },
                { name: 'Modelo', value: `\`${data.model}\``, inline: true },
                { name: 'Servidores Liberados', value: guildList }
            );
        message.reply({ embeds: [embed] });
    },

    handleToggle(message: Message, args: string[], data: UserTokenData, db: TokenDatabase, enable: boolean) {
        const targetId = args[1] || message.guild?.id;
        if (!targetId) return message.reply("⚠️ ID necessário ou use dentro de um servidor.");

        if (enable) {
            if (!data.allowed_guilds.includes(targetId)) {
                data.allowed_guilds.push(targetId);
                message.reply(`✅ IA liberada para o server \`${targetId}\`.`);
            } else {
                message.reply("⚠️ Já estava liberado.");
            }
        } else {
            data.allowed_guilds = data.allowed_guilds.filter(id => id !== targetId);
            message.reply(`🚫 IA removida do server \`${targetId}\`.`);
        }
        this.saveTokens(db);
    }
};