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
import { Command } from "../tools/interfaces/Command";
import { getGuildAIConfig } from '../tools/utils/tokenHelper';
import axios from 'axios';

function sanitizeOutput(text: string): string {
    if (!text) return text;
    return text
        .replace(/@everyone/g, '@everyоne')
        .replace(/@here/g, '@hеre')        
        .replace(/<@&(\d+)>/g, '<@&\u200b$1>'); 
}

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

function parseAIJSON(text: string): any {
    try {
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);

        if (parsed.sintese) parsed.sintese = sanitizeOutput(parsed.sintese);
        if (parsed.topicos) parsed.topicos = parsed.topicos.map((t: string) => sanitizeOutput(t));
        if (parsed.participantes) parsed.participantes = parsed.participantes.map((p: string) => sanitizeOutput(p));
        if (parsed.arco_geral) parsed.arco_geral = sanitizeOutput(parsed.arco_geral);
        if (parsed.conclusoes) parsed.conclusoes = parsed.conclusoes.map((c: string) => sanitizeOutput(c));

        return parsed;
    } catch (e) {
        console.error("Falha ao parsear JSON da IA. Retorno:", text);
        return { sintese: "Erro de formatação.", topicos: [], participantes: [], contexto: "Erro" };
    }
}

async function chamarIAResumo(prompt: string, config: any): Promise<string> {
    if (!config || !config.provider) throw new Error("Configuração de IA inválida.");

    if (config.provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
        const body = { contents: [{ parts: [{ text: prompt }] }] };
        const res = await axios.post(url, body);

        if (!res.data.candidates || !res.data.candidates[0]) throw new Error("Gemini não retornou resposta.");
        return res.data.candidates[0].content.parts[0].text;
    }
    else if (config.provider === 'openai') {
        const url = `https://api.openai.com/v1/chat/completions`;
        const body = { model: config.model, messages: [{ role: "user", content: prompt }] };
        const res = await axios.post(url, body, { headers: { 'Authorization': `Bearer ${config.key}` } });
        return res.data.choices[0].message.content;
    }
    throw new Error(`Provedor ${config.provider} não suportado.`);
}

export const command: Command = {
    name: "resume",
    description: "Cria resumos em blocos categorizados de longos períodos de RP.",
    aliases: ["resumo", "recap"],
    execute: async (message: Message, args: string[]) => {

        const aiConfig = await getGuildAIConfig(message.guild!.id);
        if (!aiConfig) return message.reply("❌ **Erro:** Nenhuma IA está configurada para este servidor.");

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
            else if (parsedStart) { endDate = new Date(parsedStart); endDate.setHours(23, 59, 59); }
        } else if (rawDateString.trim() !== "") {
            const parsedDay = parseCustomDate(rawDateString);
            if (parsedDay) {
                startDate = new Date(parsedDay); startDate.setHours(0, 0, 0);
                endDate = new Date(parsedDay); endDate.setHours(23, 59, 59);
            }
        }

        if (startDate > endDate) return message.reply("❌ A data de início não pode ser depois da data de fim.");

        const loadMsg = await message.reply(`⏳ **Puxando os arquivos da Akáshica...**`);

        try {
            const startSnowflake = dateToSnowflake(startDate);
            const endSnowflake = dateToSnowflake(endDate);

            let messages: Message[] = [];
            let lastId: string | undefined = endSnowflake;
            let keepFetching = true;

            while (keepFetching && messages.length < 1200) {
                const fetched = await targetChannel.messages.fetch({ limit: 100, before: lastId });
                if (fetched.size === 0) break;

                for (const [id, msg] of fetched) {
                    if (BigInt(id) < BigInt(startSnowflake)) { keepFetching = false; break; }
                    if (!msg.content.startsWith("rp!") && !msg.author.bot && msg.content.trim() !== "") {
                        messages.push(msg);
                    } else if (msg.webhookId) {
                        messages.push(msg);
                    }
                }
                lastId = fetched.last()?.id;
            }

            if (messages.length === 0) return loadMsg.edit("📭 Nenhuma mensagem válida de RP encontrada neste período.");

            messages.reverse(); 

            const chunkSize = 200;
            const chunks: Message[][] = [];
            for (let i = 0; i < messages.length; i += chunkSize) {
                chunks.push(messages.slice(i, i + chunkSize));
            }

            let allSummariesData: any[] = [];
            let estimatedTimeText = "Calculando...";

            for (let i = 0; i < chunks.length; i++) {
                await loadMsg.edit(`🧠 **Processando Bloco ${i + 1} de ${chunks.length}...** ⏳ ${estimatedTimeText}`);

                const startTimeChunk = Date.now();
                const chunkLog = chunks[i].map(m => `[${m.createdAt.toLocaleTimeString('pt-BR')}] ${m.author.username}: ${m.content}`).join("\n");

                const promptJSON = `Analise este log de RP. Responda ESTRITAMENTE em JSON:
{ "topicos": ["assunto 1"], "sintese": "O que aconteceu (1 parágrafo)", "participantes": ["A fez algo"] }
Log:\n${chunkLog.substring(0, 25000)}`;

                let rawAIResponse = "";
                let attempt = 1;
                let success = false;

                // LOOP DE TENTATIVAS PARA O BLOCO (Contra Erro 503)
                while (!success) {
                    try {
                        rawAIResponse = await chamarIAResumo(promptJSON, aiConfig);
                        success = true;
                    } catch (error: any) {
                        const errorMsg = error.response?.data?.error?.message || error.message || error.toString();
                        if (errorMsg.includes('503') || errorMsg.includes('Overloaded') || errorMsg.includes('high demand')) {
                            await loadMsg.edit(`🔥 **Servidores lotados (Erro 503)!**\n🔄 Tentando de novo parte ${i + 1} (Tentativa ${attempt})...`);
                            await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5 segundos
                            attempt++;
                        } else {
                            // Se for outro erro (429, safety, etc), joga pro try-catch principal
                            throw error; 
                        }
                    }
                }

                allSummariesData.push(parseAIJSON(rawAIResponse));
                
                if (i === 0 && chunks.length > 1) {
                    const timeTaken = Date.now() - startTimeChunk;
                    const etaMs = timeTaken * (chunks.length - 1);
                    const etaSec = Math.ceil(etaMs / 1000);
                    estimatedTimeText = etaSec > 60 ? `(~${Math.ceil(etaSec / 60)} min restantes)` : `(~${etaSec} seg restantes)`;
                }
            }

            await loadMsg.edit("✨ **Organizando as páginas...**");

            const pages: EmbedBuilder[] = [];
            const MAX_ITEMS_PER_PAGE = 30; 

            const allTopics = [...new Set(allSummariesData.flatMap(d => d.topicos || []).filter(Boolean))];
            if (allTopics.length === 0) {
                pages.push(new EmbedBuilder().setTitle("📌 Todos os Tópicos Abordados").setColor(0x00FF00).setDescription("Nenhum tópico encontrado."));
            } else {
                for (let i = 0; i < allTopics.length; i += MAX_ITEMS_PER_PAGE) {
                    const chunk = allTopics.slice(i, i + MAX_ITEMS_PER_PAGE);
                    const title = allTopics.length > MAX_ITEMS_PER_PAGE ? `📌 Todos os Tópicos Abordados (Parte ${Math.floor(i / MAX_ITEMS_PER_PAGE) + 1})` : "📌 Todos os Tópicos Abordados";

                    pages.push(new EmbedBuilder()
                        .setTitle(title)
                        .setColor(0x00FF00)
                        .setDescription(chunk.map(t => `• ${t}`).join('\n').substring(0, 4000))
                    );
                }
            }

            const allActions = allSummariesData.flatMap(d => d.participantes || []).filter(Boolean);
            if (allActions.length === 0) {
                pages.push(new EmbedBuilder().setTitle("👥 Ações e Participantes").setColor(0xFFA500).setDescription("Nenhuma ação registada."));
            } else {
                for (let i = 0; i < allActions.length; i += MAX_ITEMS_PER_PAGE) {
                    const chunk = allActions.slice(i, i + MAX_ITEMS_PER_PAGE);
                    const title = allActions.length > MAX_ITEMS_PER_PAGE ? `👥 Ações e Participantes (Parte ${Math.floor(i / MAX_ITEMS_PER_PAGE) + 1})` : "👥 Ações e Participantes";

                    pages.push(new EmbedBuilder()
                        .setTitle(title)
                        .setColor(0xFFA500)
                        .setDescription(chunk.map(a => `• ${a}`).join('\n').substring(0, 4000))
                    );
                }
            }

            let timelineEmbed = new EmbedBuilder().setTitle("📜 Linha do Tempo (Eventos)").setColor(0x5865F2);
            let fieldCount = 0;

            for (let i = 0; i < allSummariesData.length; i++) {
                const data = allSummariesData[i];
                const startMsg = chunks[i][0];
                const endMsg = chunks[i][chunks[i].length - 1];

                const startStr = `${startMsg.createdAt.toLocaleDateString('pt-BR')} às ${startMsg.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                const endStr = `${endMsg.createdAt.toLocaleDateString('pt-BR')} às ${endMsg.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                const timeRange = startStr === endStr ? startStr : `${startStr} até ${endStr}`;

                timelineEmbed.addFields({ name: `Parte ${i + 1} (${timeRange})`, value: data.sintese || "Sem dados." });
                fieldCount++;

                if (fieldCount === 15 || i === allSummariesData.length - 1) {
                    pages.push(timelineEmbed);
                    timelineEmbed = new EmbedBuilder().setTitle("📜 Linha do Tempo (Cont.)").setColor(0x5865F2);
                    fieldCount = 0;
                }
            }

            let currentPage = 0;

            const getButtons = (page: number, showSuperButton: boolean = true) => {
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('prev_page').setLabel('◀ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                    new ButtonBuilder().setCustomId('next_page').setLabel('Próximo ▶').setStyle(ButtonStyle.Secondary).setDisabled(page === pages.length - 1)
                );
                if (showSuperButton && chunks.length > 1) {
                    row.addComponents(new ButtonBuilder().setCustomId('super_resumo').setLabel('🌟 Resumo Definitivo').setStyle(ButtonStyle.Success));
                }
                return row;
            };

            const finalMsg = await loadMsg.edit({ content: "✅ **Análise Completa!**", embeds: [pages[0]], components: [getButtons(0)] });

            const collector = finalMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 600000 });

            collector.on('collect', async (i: ButtonInteraction) => {
                if (i.user.id !== message.author.id) return i.reply({ content: "❌ Apenas quem pediu o resumo pode usar os botões.", ephemeral: true });

                if (i.customId === 'prev_page') {
                    currentPage--;
                    await i.update({ embeds: [pages[currentPage]], components: [getButtons(currentPage)] });
                }
                else if (i.customId === 'next_page') {
                    currentPage++;
                    await i.update({ embeds: [pages[currentPage]], components: [getButtons(currentPage)] });
                }
                else if (i.customId === 'super_resumo') {
                    await i.update({ content: "⏳ **Compilando o Resumo Definitivo...** 🌟", components: [] });

                    const supersummaryPrompt = `Sintetize estes resumos em uma narrativa única.\n${JSON.stringify(allSummariesData)}\nResponda ESTRITAMENTE em JSON:\n{ "arco_geral": "História inteira", "conclusoes": ["A levou a B"] }`;

                    let rawSuperResponse = "";
                    let attempt = 1;
                    let success = false;

                    // LOOP DE TENTATIVAS PARA O SUPER RESUMO
                    while (!success) {
                        try {
                            rawSuperResponse = await chamarIAResumo(supersummaryPrompt, aiConfig);
                            success = true;
                        } catch (error: any) {
                            const errorMsg = error.response?.data?.error?.message || error.message || error.toString();
                            if (errorMsg.includes('503') || errorMsg.includes('Overloaded') || errorMsg.includes('high demand')) {
                                await finalMsg.edit({ content: `🔥 **ERRO 503!** 🍟 Servidores lotados.\n🔄 Tentando compilar o Resumo Definitivo de novo (Tentativa ${attempt})...` });
                                await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5 segundos
                                attempt++;
                            } else {
                                await finalMsg.edit({ content: "❌ Erro ao gerar o Super Resumo. (Falha na IA ou bloqueio de conteúdo)", components: [getButtons(currentPage)] });
                                break; // Interrompe o while em caso de falha não-503
                            }
                        }
                    }

                    if (success) {
                        try {
                            const superData = parseAIJSON(rawSuperResponse);

                            const superEmbed = new EmbedBuilder()
                                .setColor(0xFFD700)
                                .setTitle(`🌟 SUPER RESUMO FINAL`)
                                .addFields(
                                    { name: "📖 Arco Geral", value: superData.arco_geral || "Sem dados." },
                                    { name: "✅ Conclusões e Desdobramentos", value: superData.conclusoes?.map((c: string) => `• ${c}`).join('\n') || "Sem detalhes." }
                                );

                            pages.push(superEmbed);
                            currentPage = pages.length - 1;

                            await finalMsg.edit({ content: "✨ **Compilado com sucesso!**", embeds: [pages[currentPage]], components: [getButtons(currentPage, false)] });
                        } catch (err) {
                            console.error("Erro no Parse do Super Resumo:", err);
                            await finalMsg.edit({ content: "❌ Erro ao montar o Super Resumo. (Falha de leitura do JSON)", components: [getButtons(currentPage)] });
                        }
                    }
                }
            });

            collector.on('end', () => { finalMsg.edit({ components: [] }).catch(() => { }); });

        } catch (error: any) {
            console.error(error);
            const errorMsg = error.response?.data?.error?.message || error.message || error.toString();
            let errText = "❌ Erro ao puxar mensagens ou contatar a IA.";

            if (errorMsg.includes('GoogleGenerativeAI Error') && errorMsg.includes('was blocked')) {
                errText = "⚠️ **Algo no teu texto passou totalmente dos limites e a IA não gostou. Toma cuidado aí.**";
            }
            else if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Quota')) {
                const limitMatch = errorMsg.match(/limit:\s*(\d+)/i);
                if (errorMsg.includes('Quota') || limitMatch) {
                    const limitAmount = limitMatch ? limitMatch[1] : "várias";
                    errText = `🛑 **ERRO! LIMITE ATINGIDO!** A IA estourou a cota de **${limitAmount}** requisições diárias.`;
                } else {
                    errText = `🔥 **CALMA AÍ!** A IA foi bloqueada por spam (Rate Limit). Tente novamente em instantes.`;
                }
            } else if (errorMsg.includes('503') || errorMsg.includes('Overloaded') || errorMsg.includes('high demand')) {
                errText = "🔥 **ERRO: ESTÃO FRITANDO OS SERVIDORES! 🍟** Alta demanda na IA do Google. Tente mais tarde.";
            }

            await loadMsg.edit(errText);
        }
    }
};