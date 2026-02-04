import fs from 'fs';
import path from 'path';
import { SlashCommandBuilder, ChatInputCommandInteraction, Message, Client, TextChannel, NewsChannel } from 'discord.js';

const DATA_DIR = path.join(__dirname, '../Data');

// Interface compatível com o sistema novo (tul.ts)
interface Tupper {
    id: number;
    name: string;
    brackets: string[]; // ex: ["pablo:", ""]
    avatar_url: string;
}

interface UserData {
    tuppers: Tupper[];
}

export default {
    name: 'webhook',
    description: 'Sistema de Tuppers/Webhooks',

    data: new SlashCommandBuilder()
        .setName('webhook')
        .setDescription('Status do sistema de Webhook'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        await interaction.reply({ content: "🎭 Sistema automático ativo.", ephemeral: true });
    },
    
    execute(message: Message, args: string[]) {
        message.reply("🎭 Sistema automático ativo.");
    },

    // Esta função é chamada pelo command_checkout.ts
    async processMessage(message: Message, client: Client): Promise<boolean> {
        if (message.author.bot || !message.content) return false;

        // 1. Carrega o arquivo JSON individual do usuário (Novo padrão)
        const filePath = path.join(DATA_DIR, `tupper_${message.author.id}.json`);
        
        // Se o arquivo não existir, o usuário não tem tuppers criados no novo sistema
        if (!fs.existsSync(filePath)) return false;

        let userData: UserData;
        try { 
            const raw = fs.readFileSync(filePath, 'utf8');
            userData = JSON.parse(raw); 
        } catch (e) { return false; }

        if (!userData.tuppers || userData.tuppers.length === 0) return false;

        // 2. Ordena os tuppers por tamanho do prefixo (do maior para o menor)
        // Isso evita bugs onde "pablo escobar:" é confundido com "pablo:"
        const validTuppers = userData.tuppers.filter(t => t.brackets && t.brackets.length >= 2);
        validTuppers.sort((a, b) => b.brackets[0].length - a.brackets[0].length);

        // 3. Procura o match
        for (const tupper of validTuppers) {
            const prefix = tupper.brackets[0];
            const suffix = tupper.brackets[1];

            const content = message.content.trim(); // Remove espaços acidentais no começo

            // Verifica se a mensagem começa com o prefixo (case insensitive)
            if (content.toLowerCase().startsWith(prefix.toLowerCase()) && 
               (!suffix || content.toLowerCase().endsWith(suffix.toLowerCase()))) {

                // 4. Extrai o texto da mensagem (remove o gatilho)
                let textToSend = content.substring(prefix.length);
                if (suffix) {
                    textToSend = textToSend.substring(0, textToSend.length - suffix.length);
                }
                textToSend = textToSend.trim();

                // Se o texto estiver vazio e não tiver anexo, ignora
                if (!textToSend && message.attachments.size === 0) return false;

                // 5. Envia o Webhook
                await this.sendWebhook(message, tupper, textToSend);
                return true; // Retorna true para o checkout parar de procurar outros comandos
            }
        }

        return false;
    },

    async sendWebhook(message: Message, tupper: Tupper, content: string) {
        const channel = message.channel;

        // Verifica se é um canal de texto/news válido
        if (!(channel instanceof TextChannel) && !(channel instanceof NewsChannel)) return;

        try {
            const webhooks = await channel.fetchWebhooks();
            
            // Tenta achar um webhook do próprio bot para reutilizar
            let webhook = webhooks.find(wh => wh.owner?.id === message.client.user?.id);

            if (!webhook) {
                webhook = await channel.createWebhook({
                    name: 'RPTool Proxy',
                    avatar: message.client.user?.displayAvatarURL(),
                });
            }

            // Tenta apagar a mensagem original do usuário
            if (message.deletable) await message.delete().catch(() => {}); 

            // Envia a mensagem com a "cara" do personagem
            await webhook.send({
                content: content || " ", // Espaço em branco caso só tenha imagem
                username: tupper.name,
                avatarURL: tupper.avatar_url,
                files: Array.from(message.attachments.values()) // Repassa imagens/arquivos
            });

        } catch (err) {
            console.error("Erro ao enviar webhook:", err);
        }
    }
};