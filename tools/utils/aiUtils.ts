import { Message, TextChannel } from "discord.js";
import { OCModel } from "../models/OCSchema";
import { getGuildAIConfig } from './tokenHelper';
import { sanitizeOutput, escapeRegex, normalize as normalizeText } from './text';
import { chamarIA } from './ai/client';
import { getOrCreateProxyWebhook } from '../webhook';
import { channelHasAI } from './ocCache';
import { EventCheckout } from '../eventCheckout';

export const autoTimers = new Map<string, NodeJS.Timeout>();

// Cooldown por OC (em memória): última vez que o NPC respondeu sozinho no autoMode.
const lastAutoReply = new Map<string, number>();
const MENTION_DELAY_MS = 5000; // "tempo de digitação" antes de responder
// O conteúdo cita o nome do OC? (qualquer palavra significativa do nome, com limite de palavra)
function mentionsOC(content: string, oc: any): boolean {
    const text = normalizeText(content);
    const nameWords = normalizeText(oc.name).split(/\s+/).filter((w: string) => w.length >= 3);
    return nameWords.some((w: string) => new RegExp(`\\b${escapeRegex(w)}\\b`).test(text));
}
function scheduleAutoReply(id: string, oc: any, channel: TextChannel, delayMs: number): void {
    const timer = setTimeout(() => {
        autoTimers.delete(id);
        lastAutoReply.set(id, Date.now());
        triggerAIGeneration(channel, oc).catch(e => console.error('[IA] Erro no autoMode:', e));
    }, delayMs);
    autoTimers.set(id, timer);
}

export async function handleAIMessage(message: Message): Promise<boolean> {
    if (message.author.bot || message.content.startsWith("rp!")) return false;
    if (!message.guild) return false;

    // Curto-circuito: canal sem IA de OC ativa não gera query nenhuma.
    if (!channelHasAI(message.channel.id)) return false;

    const activeOCs = await OCModel.find({ "ai.enabled": true, "ai.activeChannelId": message.channel.id });
    if (activeOCs.length === 0) return false;

    const channel = message.channel as TextChannel;
    const now = Date.now();
    let triggered = false;

    for (const aiOC of activeOCs) {
        // ── Gatilho manual: ai:<prefixo><sufixo> → resposta imediata ──
        const manualTrigger = `ai:${aiOC.prefix}${aiOC.suffix}`.trim();
        if (message.content.trim().toLowerCase() === manualTrigger.toLowerCase()) {
            message.delete().catch(() => { });
            triggerAIGeneration(channel, aiOC).catch(e => console.error('[IA] Erro no gatilho manual:', e));
            triggered = true;
            continue;
        }

        // ── autoMode: o NPC participa sozinho da conversa ──
        if (!aiOC.ai.autoMode) continue;

        const id = aiOC.id;
        if (autoTimers.has(id)) continue; // já há uma resposta agendada nesta janela

        const cooldownMs = Math.max(5, aiOC.ai.replyDelay || 120) * 1000;
        const last = lastAutoReply.get(id) || 0;

        if (mentionsOC(message.content, aiOC)) {
            // Citaram o nome / perguntaram pra ele → responde rápido, ignorando o cooldown
            scheduleAutoReply(id, aiOC, channel, MENTION_DELAY_MS);
        } else if (now - last >= cooldownMs) {
            // Conversa normal → participa periodicamente, respeitando o intervalo
            scheduleAutoReply(id, aiOC, channel, MENTION_DELAY_MS);
        }
    }

    return triggered;
}

export async function triggerAIGeneration(channel: TextChannel, oc: any) {
    await channel.sendTyping().catch(() => { });

    const rawMsgs = await channel.messages.fetch({ limit: 25 });

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

Use os NOMES que aparecem no histórico para saber quem é quem, e leve em conta as tuas memórias acima. Responda de forma natural à conversa, agindo como se estivesses participando dela e ESTRITAMENTE IGUAL ao teu personagem. Não dê avisos de IA.

Se neste momento o teu personagem não tem nada relevante a dizer (a conversa não é com ele nem lhe interessa), retorna "resposta" como string vazia "" para ficar calado.

⚠️ REGRA CRUCIAL DE FORMATAÇÃO ⚠️
Você deve retornar EXCLUSIVAMENTE um objeto JSON válido (sem blocos de código markdown ou crases) contendo duas chaves:

"resposta": A fala e ação do seu personagem para o chat (string).

"novas_memorias": Uma lista de strings curtas (max 100 caracteres cada) com fatos novos e muito importantes que você aprendeu nesta conversa e que seu personagem deve lembrar no futuro (ex: o nome de alguém novo, um segredo revelado, um local descoberto). Se não houver nada realmente novo ou relevante para lembrar, retorne uma lista vazia [].

Exemplo de formato esperado:
{
"resposta": "Te encaro de cima a baixo com um olhar desconfiado Quem é você e como sabe o meu nome?",
"novas_memorias": ["Conheci um estranho na taverna", "O estranho sabe o meu nome verdadeiro"]
}`;

    const aiConfig = await getGuildAIConfig(channel.guild.id);

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
            let rawResponse = await chamarIA(masterPrompt, aiConfig, { json: true });
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

    // Personagem optou por ficar em silêncio (resposta vazia) → não envia nada
    if (!respostaDaIA || !respostaDaIA.trim()) return;

    try {
        // Mesma webhook do proxy de OC (tools/webhook.ts) — nome/avatar consistentes
        const hook = await getOrCreateProxyWebhook(channel);

        await hook.send({
            content: respostaDaIA,
            username: oc.name,
            avatarURL: oc.avatar
        });
    } catch (err) {
        console.error("Erro ao enviar webhook da IA:", err);
    }
}

// ─── Auto-inscrição no EventCheckout ─────────────────────────────────────────
// IA de OC (auto-responder de NPC): mensagens em canais com um OC de IA ativo
// disparam geração — por gatilho manual (ai:prefixo) ou autoMode com delay.
// handleAIMessage já filtra bots/prefixos/DMs e devolve boolean.
EventCheckout.onMessageCreate('oc:ai', (msg: Message) => handleAIMessage(msg));