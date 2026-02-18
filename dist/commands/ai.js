"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const api_1 = require("../api");
const tokenHelper_1 = require("./utils/tokenHelper");
exports.default = {
    name: 'ai',
    description: 'Conversa com um NPC via IA',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ai')
        .setDescription('Conversa com a IA')
        .addStringOption(op => op.setName('mensagem').setDescription('O que você quer falar?').setRequired(true)),
    async executeSlash(interaction) {
        const msg = interaction.options.getString('mensagem');
        if (!msg)
            return;
        await interaction.deferReply();
        await this.runAI(interaction, msg);
    },
    async execute(message, args) {
        const userMessage = args.join(' ');
        if (!userMessage)
            return message.reply("⚠️ Você precisa falar algo!");
        const loading = await message.reply("🧠 **[ Pensando... ]**");
        await this.runAI(loading, userMessage, true);
    },
    async runAI(target, text, isEdit = false) {
        const guildId = target.guildId || target.guild?.id;
        try {
            const config = await (0, tokenHelper_1.getGuildAIConfig)(guildId);
            if (!config) {
                const errText = "⚠️ Nenhum token configurado. Use `rp!token` para configurar.";
                if (isEdit)
                    target.edit(errText);
                else
                    target.editReply(errText);
                return;
            }
            const replyText = await api_1.api.chat("RPTool", "Você é um bot assistente de RPG engraçadão da galera. Seja útil, breve e use gírias de Discord.", text, config);
            if (replyText.includes('503') || replyText.includes('high demand') || replyText.includes('Service Unavailable')) {
                const msgFrita = "🔥 **ERRO: ESTÃO FRITANDO OS SERVIDORES!** 🍟\nAlta demanda na IA do Google (Erro 503). Espera um pouquinho que já esfria.";
                if (isEdit)
                    target.edit(msgFrita);
                else
                    target.editReply(msgFrita);
                return;
            }
            if (isEdit)
                target.edit(replyText);
            else
                target.editReply(replyText);
        }
        catch (error) {
            console.error(`[AI Error] ${error.message}`);
            let errText = "😵‍💫 **Minha cabeça deu um nó... Tenta de novo?**";
            const errorMsg = error.message || error.toString();
            if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Quota exceeded')) {
                const limitMatch = errorMsg.match(/limit:\s*(\d+)/i);
                if (errorMsg.includes('Quota') || limitMatch) {
                    const limitAmount = limitMatch ? limitMatch[1] : "várias";
                    errText = `🛑 **ERRO! LIMITE ATINGIDO!** Você pode ter apenas **${limitAmount}** mensagens por dia. Volte amanhã nesse mesmo horário, ou use \`rp!token\` pra mudar de API.`;
                }
                else {
                    const match = errorMsg.match(/retry in (\d+(\.\d+)?)/) || errorMsg.match(/after (\d+)/);
                    let seconds = 60;
                    if (match) {
                        seconds = Math.ceil(parseFloat(match[1]));
                    }
                    errText = `🔥 **CALMA AÍ! Muita mensagem pra ler!**\n⏳ *O cérebro fritou... Tenta de novo em **${seconds}s**.*`;
                }
            }
            else if (errorMsg.includes('503') || errorMsg.includes('Overloaded') || errorMsg.includes('high demand')) {
                errText = "🔥 **ERRO: ESTÃO FRITANDO OS SERVIDORES!** 🍟\nAlta demanda na IA do Google (Erro 503). Espera um pouquinho que já esfria.";
            }
            if (isEdit)
                target.edit(errText);
            else
                target.editReply(errText);
        }
    }
};
