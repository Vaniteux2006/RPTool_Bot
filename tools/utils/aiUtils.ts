import axios from 'axios';
import { Message, TextChannel } from "discord.js";
import { OCModel } from "../models/OCSchema";
import { getGuildAIConfig } from './tokenHelper';
import { sanitizeOutput } from './textUtils';

export const autoTimers = new Map<string, NodeJS.Timeout>();

export async function chamarIA(prompt: string, config: any): Promise<string> {
    try {
        if (config.provider === 'gemini') {

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
            const body = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            };
            const res = await axios.post(url, body);
            return res.data.candidates[0].content.parts[0].text;
        }
        else if (config.provider === 'openai') {
            // FALTAVAM AS ASPAS AQUI
            const url = 'https://api.openai.com/v1/chat/completions';
            const body = {
                model: config.model,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            };
            const res = await axios.post(url, body, {
                // FALTAVAM AS CRASES AQUI EM VOLTA DO BEARER
                headers: { 'Authorization': `Bearer ${config.key}` }
            });
            return res.data.choices[0].message.content;
        }
        
        throw new Error("Provedor de IA não suportado.");
        
    } catch (error) {
        console.error("❌ Erro na API da IA:", error);
        throw error;
    }
}

export async function handleAIMessage(message: Message): Promise<boolean> {
    if (message.author.bot || message.content.startsWith("rp!")) return false;

    const activeOCs = await OCModel.find({ "ai.enabled": true, "ai.activeChannelId": message.channel.id });
    if (activeOCs.length === 0) return false;

    let triggered = false;

    for (const aiOC of activeOCs) {
        const manualTrigger = `ai:${aiOC.prefix}${aiOC.suffix}`.trim();
        const isManual = message.content.trim().toLowerCase() === manualTrigger.toLowerCase();

        if (isManual) {
            message.delete().catch(() => { });
            triggerAIGeneration(message.channel as TextChannel, aiOC);
            triggered = true;
            continue;
        }

        if (aiOC.ai.autoMode) {
            if (autoTimers.has(aiOC.id)) {
                clearTimeout(autoTimers.get(aiOC.id)!);
            }

            const delayMs = (aiOC.ai.replyDelay || 30) * 1000;
            const timer = setTimeout(() => {
                triggerAIGeneration(message.channel as TextChannel, aiOC);
                autoTimers.delete(aiOC.id);
            }, delayMs);

            autoTimers.set(aiOC.id, timer);
        }
    }

    return triggered;
}

export async function triggerAIGeneration(channel: TextChannel, oc: any) {
    await channel.sendTyping().catch(() => { });

    const rawMsgs = await channel.messages.fetch({ limit: 15 });

    const msgs = Array.from(rawMsgs.values())
        .reverse()
        .filter(m => !m.content.startsWith("rp!") && !m.content.includes(":ai") && m.content.trim() !== "");

    let chatHistory = msgs.map(m => {
        const authorName = m.author.username;
        return `${authorName}: ${m.content}`;
    }).join("\n");

    const mems = oc.ai.memories.map((m: any) => `- ${m.content}`).join("\n");

    const masterPrompt = `Você está prestes a interpretar o personagem "${oc.name}" em um Roleplay de texto.
Esta é a sua Persona (Quem tu és, a tua história e forma de agir):
${oc.ai.persona}

Estas são suas Memórias e regras cruciais que aprendeste:
${mems || "Ainda não tens memórias adicionais."}

E esse é o Histórico recente de mensagens:
${chatHistory}

Responda de forma natural à última mensagem da conversa, agindo como se estivesse participando da conversa e agindo ESTRITAMENTE IGUAL ao teu personagem. Não dê avisos de IA.

⚠️ REGRA CRUCIAL DE FORMATAÇÃO ⚠️
Você deve retornar EXCLUSIVAMENTE um objeto JSON válido (sem blocos de código markdown ou crases) contendo duas chaves:

"resposta": A fala e ação do seu personagem para o chat (string).

"novas_memorias": Uma lista de strings curtas (max 100 caracteres cada) com fatos novos e muito importantes que você aprendeu nesta conversa e que seu personagem deve lembrar no futuro (ex: o nome de alguém novo, um segredo revelado, um local descoberto). Se não houver nada realmente novo ou relevante para lembrar, retorne uma lista vazia [].

Exemplo de formato esperado:
{
"resposta": "Te encaro de cima a baixo com um olhar desconfiado Quem é você e como sabe o meu nome?",
"novas_memorias": ["Conheci um estranho na taverna", "O estranho sabe o meu nome verdadeiro"]
}`;

    const aiConfig = getGuildAIConfig(channel.guild.id);

    if (!aiConfig) {
        await channel.send("❌ **Erro:** Nenhuma IA está configurada ou liberada para este servidor. Use `rp!token` para arrumar isso.");
        return;
    }

    let respostaDaIA = "";
    let novasMemorias: string[] = [];
    let maxRetries = 1;
    let tempMsg: Message | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            let rawResponse = await chamarIA(masterPrompt, aiConfig);
            rawResponse = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(rawResponse);

            respostaDaIA = sanitizeOutput(parsed.resposta);
            novasMemorias = parsed.novas_memorias ? parsed.novas_memorias.map((m: string) => sanitizeOutput(m)) : [];

            if (tempMsg) await tempMsg.delete().catch(() => { });
            break;

        } catch (e: any) {
            const errorMsg = e.message || e.toString();

            if ((errorMsg.includes('503') || errorMsg.includes('Overloaded')) && attempt < maxRetries) {
                if (!tempMsg) tempMsg = await channel.send(`🔥 **${oc.name}** sentiu uma falha na Matrix (Erro 503). A tentar focar de novo em 5s...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }

            console.error("Erro ao fazer parse do JSON ou chamar a API:", e);
            if (tempMsg) await tempMsg.delete().catch(() => { });

            if (errorMsg.includes('GoogleGenerativeAI Error') && errorMsg.includes('was blocked')) {
                respostaDaIA = "⚠️ **Algo no teu texto passou totalmente dos limites e a IA não gostou. Toma cuidado aí.**";
            } else {
                respostaDaIA = "*[Erro de IA: O sistema falhou ao gerar um pensamento estruturado ou a chave/modelo é inválida.]*";
            }
            break;
        }
    }

    if (novasMemorias.length > 0) {
        for (const mem of novasMemorias) {
            if (!oc.ai.memories.some((m: any) => m.content === mem)) {
                oc.ai.memories.push({
                    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
                    content: mem
                });
            }
        }
        oc.markModified('ai.memories');
        await oc.save();
        console.log(`🧠 [IA] ${novasMemorias.length} novas memórias salvas para ${oc.name}.`);
    }

    try {
        const hooks = await channel.fetchWebhooks();
        let hook = hooks.find(w => w.owner?.id === channel.client.user?.id);

        if (!hook) {
            hook = await channel.createWebhook({ name: "RPTool OC IA" });
        }

        await hook.send({
            content: respostaDaIA,
            username: oc.name,
            avatarURL: oc.avatar
        });
    } catch (err) {
        console.error("Erro ao enviar webhook da IA:", err);
    }
}