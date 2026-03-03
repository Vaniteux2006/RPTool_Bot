import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { api } from '../api';
import { getGuildAIConfig } from './utils/tokenHelper';

function sanitizeOutput(text: string): string {
    if (!text) return text;
    return text
        .replace(/@everyone/g, '@everyоne') 
        .replace(/@here/g, '@hеre')        
        .replace(/<@&(\d+)>/g, '<@&\u200b$1>'); 
}

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

    async runAI(target: any, text: string, isEdit = false) {
        const guildId = target.guildId || target.guild?.id;

        try {
            const config = await getGuildAIConfig(guildId);
            if (!config) {
                 const errText = "⚠️ Nenhum token configurado. Use `rp!token` para configurar.";
                 if (isEdit) target.edit(errText); else target.editReply(errText);
                 return;
            }

            let replyText = "";
            let maxRetries = 1; // 1 tentativa extra

            // --- SISTEMA DE RETRY ---
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    replyText = await api.chat(
                        "RPTool", 
                        "Você é um bot assistente de RPG engraçadão da galera. Seja útil, breve e use gírias de Discord.", 
                        text,
                        config
                    );
                    
                    // Se a API retornar o 503 em texto (às vezes acontece sem dar throw)
                    if (replyText.includes('503') || replyText.includes('high demand') || replyText.includes('Service Unavailable')) {
                        throw new Error('503');
                    }
                    
                    break; // Se deu certo, quebra o loop
                } catch (error: any) {
                    const errorMsg = error.message || error.toString();
                    if ((errorMsg.includes('503') || errorMsg.includes('Overloaded') || errorMsg.includes('high demand')) && attempt < maxRetries) {
                        const retryMsg = "🔥 **ERRO 503: Servidores fritando!** 🍟\nEspera aí, a IA vai tentar de novo em 5 segundos...";
                        if (isEdit) target.edit(retryMsg); else target.editReply(retryMsg);
                        
                        // Espera 5 segundos
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        continue; // Tenta de novo
                    }
                    throw error; // Se não for 503 ou se já tentou 2 vezes, joga pro catch principal
                }
            }
            // ------------------------

            replyText = sanitizeOutput(replyText);

            if (isEdit) target.edit(replyText);
            else target.editReply(replyText);

        } catch (error: any) {
            console.error(`[AI Error] ${error.message}`);

            let errText = "😵‍💫 **Minha cabeça deu um nó... Tenta de novo?**";
            const errorMsg = error.message || error.toString();

            if (errorMsg.includes('GoogleGenerativeAI Error') && errorMsg.includes('was blocked')) {
                errText = "⚠️ **Algo no teu texto passou totalmente dos limites e a IA não gostou. Toma cuidado aí.**";
            }

            if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Quota exceeded')) {
                
                const limitMatch = errorMsg.match(/limit:\s*(\d+)/i);
                
                if (errorMsg.includes('Quota') || limitMatch) {
                    const limitAmount = limitMatch ? limitMatch[1] : "várias";
                    errText = `🛑 **ERRO! LIMITE ATINGIDO!** Você pode ter apenas **${limitAmount}** mensagens por dia. Volte amanhã nesse mesmo horário, ou use \`rp!token\` pra mudar de API.`;
                } else {
                    const match = errorMsg.match(/retry in (\d+(\.\d+)?)/) || errorMsg.match(/after (\d+)/);
                    let seconds = 60; 

                    if (match) {
                        seconds = Math.ceil(parseFloat(match[1]));
                    }
                    
                    errText = `🔥 **CALMA AÍ! Muita mensagem pra ler!**\n⏳ *O cérebro fritou... Tenta de novo em **${seconds}s**.*`;
                }
            
            } else if (errorMsg.includes('503') || errorMsg.includes('Overloaded') || errorMsg.includes('high demand')) {
                errText = "🔥 **ERRO: ESTÃO FRITANDO OS SERVIDORES!** 🍟\nAlta demanda na IA do Google (Erro 503). Espera um pouquinho que já esfria.";
            }

            if (isEdit) target.edit(errText);
            else target.editReply(errText);
        }
    }
};