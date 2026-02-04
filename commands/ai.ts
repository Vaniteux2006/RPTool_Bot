import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { api } from '../api';
import { getGuildAIConfig } from './utils/tokenHelper'; // <--- Import atualizado

export default {
    name: 'ai',
    description: 'Conversa com um NPC via IA',

    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('Conversa com a IA')
        .addStringOption(op => op.setName('mensagem').setDescription('O que você quer falar?').setRequired(true)),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const msg = interaction.options.getString('mensagem');
        if (!msg) return;
        
        await interaction.deferReply(); 
        await this.runAI(interaction, msg);
    },

    async execute(message: Message | any, args: string[]) {
        const userMessage = args.join(' ');
        if (!userMessage) return message.reply("⚠️ Você precisa falar algo!");

        const loading = await message.reply("🧠 **[ Pensando... ]**");
        await this.runAI(loading, userMessage, true); 
    },

    // --- LÓGICA ATUALIZADA ---
    async runAI(target: any, text: string, isEdit = false) {
        // Tenta pegar o ID do servidor (Funciona tanto pra Slash quanto pra Message)
        const guildId = target.guildId || target.guild?.id;

        try {
            // 1. Busca a CONFIGURAÇÃO (Provider + Key + Model)
            const config = getGuildAIConfig(guildId);

            if (!config) {
                 const errText = "⚠️ Nenhum token configurado para este servidor. Use `rp!token` para doar um.";
                 if (isEdit) target.edit(errText); else target.editReply(errText);
                 return;
            }

            // 2. Chama a API passando a config
            const replyText = await api.chat(
                "RPTool", 
                "Você é um bot assistente de RPG. Seja útil, breve e use gírias de Discord.", 
                text,
                config // <--- Passamos o objeto completo agora
            );

            if (isEdit) target.edit(replyText);
            else target.editReply(replyText);

        } catch (error: any) {
            let errText = "❌ Erro neural ou token inválido.";

            if (error.message?.includes('429') || error.toString().includes('Too Many Requests')) {
                // Tenta achar números na mensagem de erro (ex: "retry after 30s")
                const match = error.message?.match(/after (\d+)/) || error.message?.match(/in (\d+)/);
                const seconds = match ? match[1] : '60'; // Default: 60s
                
                errText = `🔥 **OPA CALMA CALMA CALMA! TÃO ME PEDINDO MUITA COISA! ESPERA SÓ ${seconds} SEGUNDOS!**`;
            } else if (error.message?.includes('503') || error.toString().includes('Service Unavailable')) {
                errText = "🤯 **Calma aí que fritei a cabeça. Tô resolvendo uns B.Os, me chama daqui a pouco.**";
            }
            // ----
            console.error(error);
            if (isEdit) target.edit(errText);
            else target.editReply(errText);
            
        }
    }
};