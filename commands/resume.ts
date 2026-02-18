import { 
    Message, 
    TextChannel, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType,
    ButtonInteraction
} from "discord.js";
import { Command } from "../interfaces/Command";
import { getGuildAIConfig } from './utils/tokenHelper'; 
import axios from 'axios';

function dateToSnowflake(date: Date): string {
    const epoch = 1420070400000n; 
    const timestamp = BigInt(date.getTime());
    const snowflake = (timestamp - epoch) << 22n;
    return snowflake.toString();
}

function parseCustomDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const match = dateStr.trim().match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!match) return null;
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1; 
    const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
    const hours = match[4] ? parseInt(match[4]) : 0;
    const minutes = match[5] ? parseInt(match[5]) : 0;
    return new Date(year, month, day, hours, minutes);
}

async function chamarIAResumo(prompt: string, config: any): Promise<string> {
    try {
        if (!config || !config.provider) throw new Error("Configuração de IA inválida ou incompleta.");

        if (config.provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
            const body = { contents: [{ parts: [{ text: prompt }] }] };
            const res = await axios.post(url, body);
            
            if (!res.data.candidates || !res.data.candidates[0]) throw new Error("Gemini não retornou resposta.");
            return res.data.candidates[0].content.parts[0].text;
        } 
        else if (config.provider === 'openai') {
            const url = `https://api.openai.com/v1/chat/completions`;
            const body = {
                model: config.model,
                messages: [{ role: "user", content: prompt }]
            };
            const res = await axios.post(url, body, {
                headers: { 'Authorization': `Bearer ${config.key}` }
            });
            return res.data.choices[0].message.content;
        }
        throw new Error(`Provedor ${config.provider} não suportado.`);
    } catch (error: any) {
        console.error("❌ Erro na API da IA:", error.response?.data || error.message);
        throw error;
    }
}

export const command: Command = {
    name: "resume",
    description: "Cria um resumo inteligente do que aconteceu no RP usando IA.",
    aliases: ["resumo", "recap"],
    execute: async (message: Message, args: string[]) => {
        
        const aiConfig = await getGuildAIConfig(message.guild!.id);
        
        if (!aiConfig) {
            return message.reply("❌ **Erro:** Nenhuma IA está configurada para este servidor. Use `rp!token` para configurar.");
        }

        let targetChannel = message.channel as TextChannel;
        let argsSemCanal = args;

        if (message.mentions.channels.first()) {
            targetChannel = message.mentions.channels.first() as TextChannel;
            argsSemCanal = args.filter(a => !a.startsWith('<#'));
        }

        let endDate = new Date();
        let startDate = new Date(endDate.getTime() - (3 * 60 * 60 * 1000)); 

        const rawDateString = argsSemCanal.join(" ");

        if (rawDateString.includes("->")) {
            const [startStr, endStr] = rawDateString.split("->");
            const parsedStart = parseCustomDate(startStr);
            const parsedEnd = parseCustomDate(endStr);
            if (parsedStart) startDate = parsedStart;
            if (parsedEnd) endDate = parsedEnd;
            else if (parsedStart) {
                endDate = new Date(parsedStart);
                endDate.setHours(23, 59, 59);
            }
        } else if (rawDateString.trim() !== "") {
            const parsedDay = parseCustomDate(rawDateString);
            if (parsedDay) {
                startDate = new Date(parsedDay);
                startDate.setHours(0, 0, 0);
                endDate = new Date(parsedDay);
                endDate.setHours(23, 59, 59); 
            }
        }

        if (startDate > endDate) {
            return message.reply("❌ A data de início não pode ser depois da data de fim.");
        }

        const loadMsg = await message.reply(`⏳ **Analisando Time-Lapse...**\n> IA: ${aiConfig.provider.toUpperCase()} (${aiConfig.model})\n> Canal: <#${targetChannel.id}>\n> De: \`${startDate.toLocaleString('pt-BR')}\` até \`${endDate.toLocaleString('pt-BR')}\``);

        try {
            const startSnowflake = dateToSnowflake(startDate);
            const endSnowflake = dateToSnowflake(endDate);

            let messages: Message[] = [];
            let lastId: string | undefined = endSnowflake;
            let keepFetching = true;

            while (keepFetching && messages.length < 300) {
                const fetched = await targetChannel.messages.fetch({ limit: 100, before: lastId });
                if (fetched.size === 0) break;

                for (const [id, msg] of fetched) {
                    if (BigInt(id) < BigInt(startSnowflake)) {
                        keepFetching = false;
                        break;
                    }
                    if (!msg.content.startsWith("rp!") && !msg.author.bot && msg.content.trim() !== "") {
                        messages.push(msg);
                    } else if (msg.webhookId) {
                        messages.push(msg);
                    }
                }
                lastId = fetched.last()?.id;
            }

            if (messages.length === 0) {
                return loadMsg.edit("📭 Nenhuma mensagem válida de RP encontrada neste período.");
            }

            messages.reverse();
            const chatLog = messages.map(m => `[${m.createdAt.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}] ${m.author.username}: ${m.content}`).join("\n");
            const safeLog = chatLog.length > 20000 ? chatLog.substring(0, 20000) + "\n...[CORTADO]" : chatLog;

            await loadMsg.edit(`🧠 **Lendo ${messages.length} mensagens com a IA...**`);

            const masterPrompt = `Você é um arquivista analítico. Resuma este log de RP (Roleplay) do Discord.
            
DIRETRIZES:
1. Seja clínico, direto e jornalístico. Evite drama desnecessário.
2. Use Markdown (Negrito, Listas).
3. **SEPARE A RESPOSTA EM DUAS PARTES CLARAS usando a tag ===DIVISOR===**

ESTRUTURA DA RESPOSTA:
[PARTE 1 - RESUMO EXECUTIVO]
📌 **Tópicos Discutidos:** - Liste APENAS os 3 a 5 principais assuntos abordados em tópicos curtos (bullet points).
- Seja extremamente conciso aqui.

===DIVISOR===

[PARTE 2 - RELATÓRIO COMPLETO]
📜 **Síntese:** - O que aconteceu (1 a 2 parágrafos detalhados).

👥 **Participantes e Ações:**
- Lista dos envolvidos e suas principais ações.

📊 **Análise de Contexto:**
- Tom da conversa (ex: tenso, casual, combate) e observações relevantes.

Log:
${safeLog}

Responda APENAS com o texto formatado conforme solicitado.`;

            const resumoGerado = await chamarIAResumo(masterPrompt, aiConfig);
            
            const partes = resumoGerado.split('===DIVISOR===');
            const resumoCurto = partes[0] ? partes[0].trim() : "Erro ao gerar resumo curto.";
            const relatorioCompleto = partes[1] ? partes[1].trim() : (partes[0] || "Erro ao gerar relatório completo.");

            const embedPage1 = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`📑 Resumo Rápido: #${targetChannel.name}`)
                .setDescription(resumoCurto)
                .setFooter({ text: `Página 1/2 • ${startDate.toLocaleString('pt-BR')} - ${endDate.toLocaleString('pt-BR')}` });

            const embedPage2 = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`📜 Relatório Detalhado: #${targetChannel.name}`)
                .setDescription(relatorioCompleto.length > 4000 ? relatorioCompleto.substring(0, 4000) + "..." : relatorioCompleto)
                .setFooter({ text: `Página 2/2 • Baseado em ${messages.length} mensagens` });

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('page_1')
                    .setLabel('Resumo')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('page_2')
                    .setLabel('Saiba Mais ➜')
                    .setStyle(ButtonStyle.Primary)
            );

            const finalMsg = await loadMsg.edit({ 
                content: "✅ **Análise concluída!**", 
                embeds: [embedPage1], 
                components: [row] 
            });


            const collector = finalMsg.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 300000 
            });

            collector.on('collect', async (i: ButtonInteraction) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: "❌ Apenas quem pediu o resumo pode mudar a página.", ephemeral: true });
                }

                if (i.customId === 'page_1') {
                    row.components[0].setDisabled(true).setStyle(ButtonStyle.Secondary);
                    row.components[1].setDisabled(false).setStyle(ButtonStyle.Primary).setLabel('Saiba Mais ➜');
                    
                    await i.update({ embeds: [embedPage1], components: [row] });
                } 
                else if (i.customId === 'page_2') {
                    row.components[0].setDisabled(false).setStyle(ButtonStyle.Secondary);
                    row.components[1].setDisabled(true).setStyle(ButtonStyle.Primary).setLabel('Detalhes (Atual)');

                    await i.update({ embeds: [embedPage2], components: [row] });
                }
            });

            collector.on('end', () => {
                row.components.forEach(btn => btn.setDisabled(true));
                finalMsg.edit({ components: [row] }).catch(() => {});
            });

        } catch (error) {
            console.error(error);
            await loadMsg.edit("❌ Erro ao gerar resumo. Verifique se sua chave de IA está ativa e tem saldo.");
        }
    }
};