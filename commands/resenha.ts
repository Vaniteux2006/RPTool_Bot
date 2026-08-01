import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { getGuildAIConfig } from '../tools/utils/tokenHelper';
import { chamarIA } from '../tools/utils/ai/client';
import { withAIRetry } from '../tools/utils/ai/retry';
import { motivoInterrupcao, rotuloRetry } from '../tools/utils/ai/errors';
import { sanitizeOutput } from '../tools/utils/text';

export default {
    name: 'resenha',
    description: 'Analisa o nível de caos e resenha do chat',
    
    data: new SlashCommandBuilder()
        .setName('resenha')
        .setDescription('Analisa se o chat está em estado de Resenha (r-01) ou Paz (r-00)'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const fakeMessage: any = {
            channel: interaction.channel,
            guild: interaction.guild,
            author: interaction.user,
            reply: (content: any) => interaction.reply(content)
        };
        await this.execute(fakeMessage, []);
    },

    async execute(message: Message | any, args: string[]) {
        if (!message.channel) return;

        const guildId = message.guild?.id;
        const config = await getGuildAIConfig(guildId);

        if (!config) {
            return message.reply("⚠️ **Sem Token:** Ninguém configurou uma IA para este servidor ainda. Use `rp!token`.");
        }

        const loading = await message.reply("👀 **Lendo as últimas 100 mensagens para julgar vocês...**");

        try {
            const messages = await message.channel.messages.fetch({ limit: 100 });
            
            const history = messages.reverse()
                .filter((m: Message) => !m.content.startsWith('rp!') && !m.author.bot) // Ignora comandos e bots
                .map((m: Message) => `[${m.author.username}]: ${m.content}`)
                .join("\n");

            if (history.length < 50) {
                const msgCurta = "❌ **Pouca conversa.** O chat está morto, nem preciso de IA pra saber que NÃO HÁ RESENHA 💀.";
                return loading.edit ? await loading.edit(msgCurta) : await message.reply(msgCurta);
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

            // Retry com teto (nunca infinito): só insiste em 503/rate-limit.
            const resultado = await withAIRetry(() => chamarIA(prompt, config, { json: true }), {
                onRetry: (falha, espera, tentativa) => {
                    console.warn(`[RESENHA] Retry ${tentativa} (${falha.tipo}):`, falha.msg);
                    if (loading.edit) {
                        return loading.edit(`${rotuloRetry(falha)}\n🔄 Julgando a resenha de novo em ${espera}s... (tentativa ${tentativa})`).catch(() => null);
                    }
                },
            });

            if (!resultado.ok) {
                const { titulo, detalhe } = motivoInterrupcao(resultado.falha!);
                const msgFalha = `${titulo}\n${detalhe}`;
                return loading.edit ? await loading.edit(msgFalha) : await message.reply(msgFalha);
            }
            const rawText = resultado.valor!;

            let result;
            try {
                const cleanText = rawText.replace(/```json|```/g, '').trim();
                result = JSON.parse(cleanText);
                
                if (result.analysis) {
                    result.analysis = sanitizeOutput(result.analysis);
                }
            } catch (jsonError) {
                console.error("Erro parse JSON:", rawText);
                result = { status: "r-00", analysis: "A IA ficou confusa com a bagunça de vocês e falhou no JSON." };
            }

            let statusEmoji = "💤";
            let statusLabel = "NÃO HÁ RESENHA";

            if (result.status === "r-01") {
                statusEmoji = "🔥";
                statusLabel = "RESENHA CONFIRMADA";
            }

            const finalText = `## ${statusEmoji} ${statusLabel} — \`${result.status}\`\n> 📝 **Veredito:** ${result.analysis}`;

            if (loading.edit) await loading.edit(finalText);
            else await message.reply(finalText);

        } catch (e: any) {
            console.error(e);
            
            const errorMsg = e.message || e.toString();
            let finalMsg = "❌ Falha na análise tática. (Erro de API)";

            if (errorMsg.includes('GoogleGenerativeAI Error') && errorMsg.includes('was blocked')) {
                finalMsg = "⚠️ **Algo no teu texto passou totalmente dos limites e a IA não gostou. Toma cuidado aí.**";
            }
            else if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Quota')) {
                const match = errorMsg.match(/after (\d+)/) || errorMsg.match(/in (\d+)/);
                const seconds = match ? match[1] : '60';
                finalMsg = `🔥 **CALMA AÍ! Muita mensagem pra ler! O cérebro fritou. Tenta daqui ${seconds}s.**`;
            } else if (errorMsg.includes('503') || errorMsg.includes('Overloaded')) {
                finalMsg = "🤯 **Serviço indisponível. A IA foi de base temporariamente.**";
            }

            if (loading.edit) await loading.edit(finalMsg);
        }
    }
};