import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { api } from '../api';
import { getGuildAIConfig } from './utils/tokenHelper';

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
        
        // DeferReply é importante para a IA ter tempo de pensar sem dar timeout
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
            const config = getGuildAIConfig(guildId);

            if (!config) {
                 const errText = "⚠️ Nenhum token configurado. Use `rp!token` para configurar.";
                 if (isEdit) target.edit(errText); else target.editReply(errText);
                 return;
            }

            // AQUI O GEMINI-3-FLASH PERMANECE VIVO E INTOCADO DENTRO DA CONFIG
            const replyText = await api.chat(
                "RPTool", 
                "Você é um bot assistente de RPG. Seja útil, breve e use gírias de Discord.", 
                text,
                config
            );

            if (isEdit) target.edit(replyText);
            else target.editReply(replyText);

        } catch (error: any) {
            // Log no console só pra você saber o que rolou (não aparece pro usuário)
            console.error(`[AI Error] ${error.message}`);

            let errText = "😵‍💫 **Minha cabeça deu um nó... Tenta de novo?**";
            const errorMsg = error.message || error.toString();

            // TRATAMENTO DO ERRO 429 (COTA/SPAM)
            if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Quota exceeded')) {
                
                // Regex melhorado para pegar "retry in 27.05s" ou "after 30s"
                // O Google manda quebrado (ex: 27.076s), o Math.ceil arredonda pra cima (28s)
                const match = errorMsg.match(/retry in (\d+(\.\d+)?)/) || errorMsg.match(/after (\d+)/);
                let seconds = 60; // Padrão de segurança

                if (match) {
                    seconds = Math.ceil(parseFloat(match[1]));
                }
                
                errText = `🔥 **CALMA AÍ! Muita mensagem pra ler!**\n⏳ *O cérebro fritou... Tenta de novo em **${seconds}s**.*`;
            
            } else if (errorMsg.includes('503') || errorMsg.includes('Overloaded')) {
                errText = "🤯 **Tô processando muita coisa agora... Me dá um minutinho pra respirar!**";
            }

            // Envia a mensagem bonitinha pro usuário
            if (isEdit) target.edit(errText);
            else target.editReply(errText);
        }
    }
};