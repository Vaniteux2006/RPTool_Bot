import { 
    Message, 
    AttachmentBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    TextChannel, 
    ComponentType,
    MessageCollector,
    Client 
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { api } from '../api'; 
import { getGuildAIConfig } from './utils/tokenHelper'; // <--- Import novo

// --- CONFIGURAÇÕES E TIPOS ---

const DATA_DIR = path.join(__dirname, '../Data');
const DEFAULT_AVATAR = "https://media.discordapp.net/attachments/1459362898127098014/1459399809025703988/doguinho.png?ex=6963237c&is=6961d1fc&hm=7ea6574e5b4cc8904ba7547339c89c3874e6955bff8c72973a1aa8090422305b&=&format=webp&quality=lossless";

interface Tupper {
    id: number;
    name: string;
    brackets: string[]; 
    avatar_url: string;
    banner?: string;
    posts: number;
    birthday?: string;
    created_at: string;
    last_used: string;
    ai_enabled: boolean;
    persona: string;
    long_term_memories: string[];
}

interface UserData {
    tuppers: Tupper[];
    nextId: number;
}

interface AISession {
    userId: string;
    tupperId: number;
    tupperName: string;
    channelId: string;
    buffer: string[];
    timer: NodeJS.Timeout | null;
    delay: number; 
}

const activeSessions: { [channelId: string]: AISession } = {};

// (Função getGuildToken local REMOVIDA daqui)

// --- CLASSE PRINCIPAL ---

export default {
    name: 'tul',
    description: 'Sistema completo de Tuppers e Roleplay IA',
    aliases: ['tupper', 't'],

    // --- UTILITÁRIOS ---

    getFilePath(userId: string) {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        return path.join(DATA_DIR, `tupper_${userId}.json`);
    },

    loadData(userId: string): UserData {
        const filePath = this.getFilePath(userId);
        if (!fs.existsSync(filePath)) {
            return { tuppers: [], nextId: 1 };
        }
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
            console.error(`Erro ao ler tupper_${userId}.json`, e);
            return { tuppers: [], nextId: 1 };
        }
    },

    saveData(userId: string, data: UserData) {
        fs.writeFileSync(this.getFilePath(userId), JSON.stringify(data, null, 4));
    },

    parseArgs(args: string[]): string[] {
        const fullText = args.join(' ');
        const regex = /"([^"]+)"|(\S+)/g;
        const result: string[] = [];
        let match;
        while ((match = regex.exec(fullText)) !== null) {
            result.push(match[1] || match[2]);
        }
        return result;
    },

    // --- EXECUÇÃO ---

    async execute(message: Message, rawArgs: string[]) {
        const args = this.parseArgs(rawArgs);
        if (args.length === 0) return message.reply("⚠️ Subcomando necessário. Use `create`, `list`, `insert`, etc.");

        const command = args[0].toLowerCase();
        const userId = message.author.id;
        const data = this.loadData(userId);

        switch (command) {
            case 'create': case 'criar':
                await this.handleCreate(message, args, data);
                break;
            case 'delete': case 'deletar':
                await this.handleDelete(message, args, data);
                break;
            case 'list': case 'lista':
                await this.handleList(message, args, data);
                break;
            case 'avatar':
                await this.handleAvatar(message, args, data);
                break;
            case 'rename': case 'renomear':
                await this.handleRename(message, args, data);
                break;
            case 'prefix': case 'prefixo': 
                await this.handlePrefix(message, args, data);
                break;
            case 'find': case 'procurar':
                await this.handleFind(message, args, data);
                break;
            case 'import': case 'importar':
                await this.handleImport(message, data);
                break;
            case 'export': case 'exportar':
                await this.handleExport(message, data);
                break;
            case 'purge':
                await this.handlePurge(message, userId);
                break;
            case 'edit': case 'editar':
                await this.handleEdit(message, args, data);
                break;
            case 'ai': case 'ia':
                await this.handleConfigAI(message, args, data);
                break;
            case 'insert': case 'inserir':
                await this.handleInsert(message, args, data);
                break;
            case 'end': case 'sair':
                await this.handleEnd(message);
                break;
            case 'delay':
                await this.handleDelay(message, args);
                break;
            default:
                message.reply(`❌ Comando desconhecido: \`${command}\`.`);
        }
    },

    // --- HANDLERS BÁSICOS ---

    async handleCreate(message: Message, args: string[], data: UserData) {
        if (args.length < 3) return message.reply('⚠️ Uso: `rp!tul create "Nome" prefixo:text`');
        const name = args[1];
        const rawBrackets = args[2];
        let brackets = rawBrackets.includes('text') ? rawBrackets.split('text') : [`${rawBrackets}:`, ""];
        
        const newTupper: Tupper = {
            id: data.nextId++,
            name: name,
            brackets: brackets,
            avatar_url: message.attachments.first() ? message.attachments.first()!.url : DEFAULT_AVATAR,
            posts: 0,
            created_at: new Date().toISOString(),
            last_used: new Date().toISOString(),
            ai_enabled: false,
            persona: `Você é ${name}.`,
            long_term_memories: []
        };

        data.tuppers.push(newTupper);
        this.saveData(message.author.id, data);
        message.reply(`✅ Tupper **${name}** criado! Prefixo: \`${brackets[0]}texto${brackets[1]}\``);
    },

    async handleDelete(message: Message, args: string[], data: UserData) {
        const index = data.tuppers.findIndex(t => t.name.toLowerCase() === args[1]?.toLowerCase());
        if (index === -1) return message.reply("❌ Tupper não encontrado.");
        data.tuppers.splice(index, 1);
        this.saveData(message.author.id, data);
        message.reply("🗑️ Tupper deletado.");
    },

    async handleList(message: Message, args: string[], data: UserData) {
        if (!data.tuppers.length) return message.reply("Você não tem Tuppers.");
        let desc = data.tuppers.map(t => `**${t.name}** | Pre: \`${t.brackets[0]}text${t.brackets[1]}\``).join('\n');
        if (desc.length > 4000) desc = desc.substring(0, 4000) + "...";
        message.reply({ embeds: [new EmbedBuilder().setTitle(`Tuppers de ${message.author.username}`).setDescription(desc).setColor(0x00AE86)] });
    },

    async handleAvatar(message: Message, args: string[], data: UserData) {
        const tupper = data.tuppers.find(t => t.name.toLowerCase() === args[1]?.toLowerCase());
        if (!tupper) return message.reply("❌ Tupper não encontrado.");
        if (message.attachments.size > 0) {
            tupper.avatar_url = message.attachments.first()!.url;
            this.saveData(message.author.id, data);
            message.reply("✅ Avatar atualizado!");
        } else {
            message.reply({ embeds: [new EmbedBuilder().setTitle(tupper.name).setImage(tupper.avatar_url)] });
        }
    },

    async handleRename(message: Message, args: string[], data: UserData) {
        const tupper = data.tuppers.find(t => t.name.toLowerCase() === args[1]?.toLowerCase());
        if (!tupper) return message.reply("❌ Tupper não encontrado.");
        tupper.name = args[2];
        this.saveData(message.author.id, data);
        message.reply(`✅ Renomeado para **${args[2]}**.`);
    },

    async handlePrefix(message: Message, args: string[], data: UserData) {
        const tupper = data.tuppers.find(t => t.name.toLowerCase() === args[1]?.toLowerCase());
        if (!tupper) return message.reply("❌ Tupper não encontrado.");
        const raw = args[2];
        tupper.brackets = raw.includes('text') ? raw.split('text') : [`${raw}:`, ""];
        this.saveData(message.author.id, data);
        message.reply("✅ Prefixo atualizado.");
    },

    async handleFind(message: Message, args: string[], data: UserData) {
        const found = data.tuppers.filter(t => t.name.toLowerCase().includes(args[1]?.toLowerCase()));
        if (!found.length) return message.reply("❌ Nada encontrado.");
        message.reply(`🔍 **Resultados:**\n${found.map(t => t.name).join('\n')}`);
    },

    async handleImport(message: Message, data: UserData) {
        const attachment = message.attachments.first();
        if (!attachment) return message.reply("⚠️ Anexe um JSON.");
        try {
            const res = await fetch(attachment.url);
            const json = await res.json();
            const list = json.tuppers || (Array.isArray(json) ? json : []);
            
            let count = 0;
            for (const t of list) {
                data.tuppers.push({
                    id: data.nextId++,
                    name: t.name || "Sem Nome",
                    brackets: t.brackets || ["", ""],
                    avatar_url: t.avatar_url || DEFAULT_AVATAR,
                    posts: t.posts || 0,
                    created_at: new Date().toISOString(),
                    last_used: new Date().toISOString(),
                    ai_enabled: false,
                    persona: `Você é ${t.name}.`,
                    long_term_memories: []
                });
                count++;
            }
            this.saveData(message.author.id, data);
            message.reply(`✅ Importados **${count}** tuppers.`);
        } catch (e) { message.reply("❌ Erro no JSON."); }
    },

    async handleExport(message: Message, data: UserData) {
        const filePath = this.getFilePath(message.author.id);
        if (fs.existsSync(filePath)) {
            message.reply({ content: "📂 Backup:", files: [new AttachmentBuilder(filePath, { name: 'tuppers.json' })] });
        } else {
            message.reply("Sem dados.");
        }
    },

    async handlePurge(message: Message, userId: string) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('purge_no').setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('purge_yes').setLabel('SIM, APAGAR').setStyle(ButtonStyle.Danger)
        );
        const res = await message.reply({ content: "⚠️ **Cuidado!** Apagar TUDO?", components: [row] });
        const collector = res.createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: "Sai fora!", ephemeral: true });
            if (i.customId === 'purge_yes') {
                this.saveData(userId, { tuppers: [], nextId: 1 });
                await i.update({ content: "💥 Tudo apagado.", components: [] });
            } else {
                await i.update({ content: "Cancelado.", components: [] });
            }
        });
    },

    async handleEdit(message: Message, args: string[], data: UserData) {
        const newContent = args.slice(1).join(" ");
        if (!newContent) return message.reply("⚠️ Texto necessário.");

        const channel = message.channel as TextChannel;
        const messages = await channel.messages.fetch({ limit: 15 });
        const targetMsg = messages.find(m => m.webhookId && data.tuppers.some(t => t.name === m.author.username));
        
        if (!targetMsg) return message.reply("❌ Mensagem não encontrada.");

        const webhooks = await channel.fetchWebhooks();
        const webhook = webhooks.find(w => w.id === targetMsg.webhookId);
        
        if (webhook) {
            await webhook.editMessage(targetMsg.id, { content: newContent });
            message.delete().catch(() => {});
        } else {
            message.reply("❌ Webhook inacessível.");
        }
    },

    // --- IA & INSERT ---

    async handleConfigAI(message: Message, args: string[], data: UserData) {
        const tupper = data.tuppers.find(t => t.name.toLowerCase() === args[1]?.toLowerCase());
        if (!tupper) return message.reply("❌ Tupper não encontrado.");

        await message.reply(`🧠 **Configurando Persona de ${tupper.name}**\nEnvie mensagens descrevendo o personagem.\nEnvie **End** para finalizar.`);
        
        const channel = message.channel as TextChannel;
        
        const collector = channel.createMessageCollector({ 
            filter: m => m.author.id === message.author.id, 
            idle: 300_000 
        });

        const personaParts: string[] = [];

        collector.on('collect', m => {
            if (m.content.trim().toLowerCase() === 'end') {
                collector.stop('finished');
            } else {
                personaParts.push(m.content);
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'finished' && personaParts.length > 0) {
                tupper.persona = personaParts.join('\n');
                tupper.ai_enabled = true;
                this.saveData(message.author.id, data);
                channel.send(`✅ Persona salva! Use \`insert\` para começar.`);
            } else {
                channel.send("Cancelado.");
            }
        });
    },

    async handleInsert(message: Message, args: string[], data: UserData) {
        const tupper = data.tuppers.find(t => t.name.toLowerCase() === args[1]?.toLowerCase());
        if (!tupper) return message.reply("❌ Tupper não encontrado.");
        if (!tupper.ai_enabled) return message.reply("⚠️ Ative a IA com `rp!tul ai` antes.");

        if (activeSessions[message.channel.id]) clearInterval(activeSessions[message.channel.id].timer!);

        const session: AISession = {
            userId: message.author.id,
            tupperId: tupper.id,
            tupperName: tupper.name,
            channelId: message.channel.id,
            buffer: [],
            timer: null,
            delay: 60
        };

        activeSessions[message.channel.id] = session;
        message.reply(`🤖 **${tupper.name}** inserido! Respondendo a cada 60s.`);
        
        this.startAILoop(session, message.client);
    },

    startAILoop(session: AISession, client: Client) {
        session.timer = setInterval(async () => {
            if (session.buffer.length > 0) {
                // 1. Prepara os dados
                const contextMessages = [...session.buffer];
                session.buffer = [];

                const freshData = this.loadData(session.userId);
                const tupper = freshData.tuppers.find(t => t.id === session.tupperId);
                if (!tupper) return;

                const channel = await client.channels.fetch(session.channelId) as TextChannel;
                if (!channel) return;

                // --- PEGANDO CONFIGURAÇÃO CORRETAMENTE ---
                const guildId = channel.guild.id; 
                const aiConfig = getGuildAIConfig(guildId); 
                // -----------------------------------------

                const memoriesList = (tupper.long_term_memories || []).map(m => `- ${m}`).join('\n');
                const chatLog = contextMessages.join('\n');

                const fullPrompt = `
                Você está interpretando o personagem: ${tupper.name}.
                
                [PERSONA]
                ${tupper.persona}

                [MEMÓRIAS]
                ${memoriesList || "Nenhuma."}

                [MENSAGENS RECENTES]
                ${chatLog}

                [INSTRUÇÕES]
                1. Se a conversa não for com você ou não houver nada relevante para dizer, retorne APENAS: [NO_REPLY]
                2. Caso contrário, responda como o personagem.
                3. Se descobrir um fato novo importante sobre o usuário, adicione no final: [MEMORY: fato]
                `;

                if (channel.sendTyping) await channel.sendTyping();
                
                try {
                    // MUDANÇA: Passando o objeto de config (pode ser undefined, a API trata o erro)
                    const aiResponseRaw = await api.generateRaw(fullPrompt, aiConfig);
                    
                    let finalReply = aiResponseRaw.trim();

                    if (finalReply.includes("[NO_REPLY]")) return;

                    if (finalReply.includes("[MEMORY:")) {
                        const parts = finalReply.split("[MEMORY:");
                        finalReply = parts[0].trim();
                        const newMemory = parts[1].replace("]", "").trim();

                        if (newMemory && (!tupper.long_term_memories || !tupper.long_term_memories.includes(newMemory))) {
                            if (!tupper.long_term_memories) tupper.long_term_memories = [];
                            tupper.long_term_memories.push(newMemory);
                            this.saveData(session.userId, freshData);
                            console.log(`[IA] Memória salva: ${newMemory}`);
                        }
                    }

                    if (finalReply.length > 0) {
                        await this.sendAsWebhook(channel, tupper, finalReply);
                    }

                } catch (e: any) {
                    console.error("Erro no loop IA:", e.message);

                    // --- DETECÇÃO DE ERROS ---
                    const errorMsg = e.message || e.toString();

                    if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
                         const match = errorMsg.match(/after (\d+)/) || errorMsg.match(/in (\d+)/);
                         const seconds = match ? match[1] : '60';
                         channel.send(`🔥 **OPA CALMA CALMA CALMA! TÃO ME PEDINDO MUITA COISA! ESPERA SÓ ${seconds} SEGUNDOS!**`);
                         return; // Pula a vez, não mata
                    }

                    if (errorMsg.includes('503') || errorMsg.includes('Service Unavailable')) {
                        channel.send("🤯 **Calma aí que fritei a cabeça. Tô resolvendo uns B.Os, me chama daqui a pouco.**");
                        return; // Pula a vez, não mata
                    }
                    // -------------------------
                    
                    if (session.buffer.length === 0) {
                        let finalError = "⚠️ **Erro de IA:** Ocorreu um problema ao gerar resposta.";
                        if (errorMsg.includes("API Key")) finalError = "⚠️ **Erro de IA:** Nenhum token configurado para este servidor.";
                        
                        channel.send(finalError);
                        clearInterval(session.timer!); 
                    }
                }
            }
        }, session.delay * 1000);
    },

    async handleEnd(message: Message) {
        if (activeSessions[message.channel.id]) {
            clearInterval(activeSessions[message.channel.id].timer!);
            delete activeSessions[message.channel.id];
            message.reply("🛑 Tupper removido.");
        } else {
            message.reply("Ninguém inserido aqui.");
        }
    },

    async handleDelay(message: Message, args: string[]) {
        const session = activeSessions[message.channel.id];
        if (!session) return message.reply("Ninguém inserido aqui.");
        const sec = parseInt(args[1]);
        if (isNaN(sec) || sec < 5) return message.reply("Mínimo 5s.");
        
        session.delay = sec;
        clearInterval(session.timer!);
        this.startAILoop(session, message.client);
        message.reply(`⏱️ Delay: ${sec}s.`);
    },

    async sendAsWebhook(channel: TextChannel, tupper: Tupper, content: string) {
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(w => w.owner?.id === channel.client.user?.id);
        if (!webhook) webhook = await channel.createWebhook({ name: 'RPTool Proxy', avatar: channel.client.user?.displayAvatarURL() });
        
        await webhook.send({ content, username: tupper.name, avatarURL: tupper.avatar_url });
    },

    onMessage(message: Message) {
        if (activeSessions[message.channel.id] && !message.author.bot) {
            activeSessions[message.channel.id].buffer.push(`[${message.author.username}]: ${message.content}`);
        }
    }
};