"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const api_1 = require("../api");
const tokenHelper_1 = require("./utils/tokenHelper");
exports.default = {
    name: 'resenha',
    description: 'Analisa o nível de caos e resenha do chat',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('resenha')
        .setDescription('Analisa se o chat está em estado de Resenha (r-01) ou Paz (r-00)'),
    async executeSlash(interaction) {
        const fakeMessage = {
            channel: interaction.channel,
            guild: interaction.guild,
            author: interaction.user,
            reply: (content) => interaction.reply(content)
        };
        await this.execute(fakeMessage, []);
    },
    async execute(message, args) {
        if (!message.channel)
            return;
        const guildId = message.guild?.id;
        const config = await (0, tokenHelper_1.getGuildAIConfig)(guildId);
        if (!config) {
            return message.reply("⚠️ **Sem Token:** Ninguém configurou uma IA para este servidor ainda. Use `rp!token`.");
        }
        const loading = await message.reply("👀 **Lendo as últimas 100 mensagens para julgar vocês...**");
        try {
            const messages = await message.channel.messages.fetch({ limit: 100 });
            const history = messages.reverse()
                .filter((m) => !m.content.startsWith('rp!') && !m.author.bot) // Ignora comandos e bots
                .map((m) => `[${m.author.username}]: ${m.content}`)
                .join("\n");
            if (history.length < 50) {
                const msgCurta = "❌ **Pouca conversa.** O chat está morto, nem preciso de IA pra saber que NÃO HÁ RESENHA 💀.";
                return loading.edit ? loading.edit(msgCurta) : message.reply(msgCurta);
            }
            const prompt = `
            Atue como um juiz de "Resenha" (Caos/Zoeira) para um chat de Discord.
            Analise o histórico abaixo e classifique o estado atual.

            [CRITÉRIOS PARA "r-01" (RESENHA CONFIRMADA)]
            - Muitos xingamentos, "tretas" ou discussões acaloradas.
            - Membros desafiando ADMs/Autoridade.
            - Uso caótico de @everyone, @here ou spam.
            - Uso extensivo de gírias, memes e shitpost.
            - Riso excessivo e coletivo ("KKKKKKK").
            - Surpresa coletiva com algum evento.

            [CRITÉRIOS PARA "r-00" (NÃO HÁ RESENHA)]
            - Conversa séria demais ou técnica.
            - Tom melancólico ou triste.
            - Debate "aristocrático" (educado, green flag, sem baixaria).
            - Chat parado, apenas cumprimentos ou nada engraçado.

            [HISTÓRICO]
            ${history}

            [INSTRUÇÃO DE SAÍDA]
            Retorne APENAS um JSON cru (sem markdown de código) neste formato exato:
            {"status": "r-00" ou "r-01", "analysis": "Uma frase curta, ácida e informal em português explicando o motivo."}
            `;
            const rawText = await api_1.api.generateRaw(prompt, config);
            let result;
            try {
                const cleanText = rawText.replace(/```json|```/g, '').trim();
                result = JSON.parse(cleanText);
            }
            catch (jsonError) {
                console.error("Erro parse JSON:", rawText);
                result = { status: "r-00", analysis: "A IA ficou confusa com a bagunça de vocês e falhou no JSON." };
            }
            let statusEmoji = "💤";
            let color = 0x3498db;
            if (result.status === "r-01") {
                statusEmoji = "🔥";
                color = 0xe74c3c;
            }
            const finalText = `## Status: \`${result.status}\` ${statusEmoji}\n> 📝 **Veredito:** ${result.analysis}`;
            if (loading.edit)
                loading.edit(finalText);
            else
                message.reply(finalText);
        }
        catch (e) {
            console.error(e);
            const errorMsg = e.message || e.toString();
            let finalMsg = "❌ Falha na análise tática. (Erro de API)";
            if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
                const match = errorMsg.match(/after (\d+)/) || errorMsg.match(/in (\d+)/);
                const seconds = match ? match[1] : '60';
                finalMsg = `🔥 **CALMA AÍ! Muita mensagem pra ler! O cérebro fritou. Tenta daqui ${seconds}s.**`;
            }
            else if (errorMsg.includes('503')) {
                finalMsg = "🤯 **Serviço indisponível. A IA foi de base temporariamente.**";
            }
            // ---------------------------------------------
            if (loading.edit)
                loading.edit(finalMsg);
        }
    }
};
