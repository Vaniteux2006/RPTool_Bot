import {
    Message, PartialMessage, TextChannel, Webhook,
    MessageReaction, PartialMessageReaction, User, PartialUser,
} from "discord.js";
import { OCModel, IOC } from "./models/OCSchema";
import { EventCheckout } from "./eventCheckout";
import { userHasOC } from "./utils/ocCache";

// Fonte única em tools/utils/text.ts — re-exportado para os consumidores antigos.
import { sanitizeOutput } from './utils/text';
export { sanitizeOutput };

// ─── Content filters ──────────────────────────────────────────────────────────
// Módulos externos (ex: supercommands/censura) podem transformar o conteúdo
// que sai pelas webhooks de proxy — sem que este arquivo os conheça. Se o
// módulo for removido do bot, nada aqui quebra (projeto desmontável).
export type ProxyContentFilter = (guildId: string, channelIds: string[], text: string) => Promise<string>;
const contentFilters: ProxyContentFilter[] = [];

export function registerProxyContentFilter(filter: ProxyContentFilter): void {
    contentFilters.push(filter);
}

async function applyContentFilters(guildId: string, channelIds: string[], text: string): Promise<string> {
    let out = text;
    for (const filter of contentFilters) {
        try { out = await filter(guildId, channelIds, out); } catch { /* filtro nunca derruba o proxy */ }
    }
    return out;
}

// ─── Mensagens já consumidas pelo proxy de OC ─────────────────────────────────
// O filtro de censura (que roda DEPOIS no dispatch) consulta isto pra não
// reprocessar uma mensagem que o proxy já apagou e reenviou.
const proxiedOriginals = new Set<string>();
const PROXIED_CACHE_CAP = 2000;

function rememberProxiedOriginal(messageId: string): void {
    proxiedOriginals.add(messageId);
    if (proxiedOriginals.size > PROXIED_CACHE_CAP) {
        const oldest = proxiedOriginals.values().next().value; // Set preserva ordem de inserção
        if (oldest) proxiedOriginals.delete(oldest);
    }
}

export function wasOCProxied(messageId: string): boolean {
    return proxiedOriginals.has(messageId);
}

/**
 * Busca (ou cria) a webhook de proxy do RPTool em um canal de texto.
 * Usada pelo proxy de OC e pelo filtro de censura.
 */
export async function getOrCreateProxyWebhook(channel: TextChannel): Promise<Webhook> {
    const webhooks = await channel.fetchWebhooks();
    const existing = webhooks.find(w => w.owner?.id === channel.client.user?.id);
    if (existing) return existing;
    return channel.createWebhook({
        name: 'RPTool OC Proxy',
        avatar: channel.client.user?.displayAvatarURL()
    });
}

/**
 * Webhook não faz reply nativo — replicamos o contexto como um embed clicável
 * (estilo PluralKit/Tupperbox). Devolve undefined se a mensagem não é resposta
 * ou se a referenciada não está mais acessível.
 */
export async function buildReplyEmbed(message: Message): Promise<object | undefined> {
    if (!message.reference?.messageId || !message.guild) return undefined;
    try {
        const ref = await message.channel.messages.fetch(message.reference.messageId);
        const refAuthor = (ref.member?.displayName || ref.author.username);
        let snippet = (ref.content || "").replace(/\n/g, " ").trim();
        if (snippet.length > 100) snippet = snippet.slice(0, 100) + "…";
        if (!snippet) {
            snippet = ref.attachments.size > 0 ? "*(anexo)*" : (ref.embeds.length > 0 ? "*(embed)*" : "*(mensagem)*");
        }
        const jump = `https://discord.com/channels/${message.guild.id}/${ref.channelId}/${ref.id}`;
        return {
            color: 0x4f545c,
            author: {
                name: `↩️ ${refAuthor}`,
                icon_url: ref.author.displayAvatarURL()
            },
            description: `**[Respondendo a:](${jump})** ${sanitizeOutput(snippet)}`
        };
    } catch {
        return undefined;
    }
}

// ─── Buffer do messageCount dos OCs ──────────────────────────────────────────
// Métrica exibida no rp!oc info. Acumula em memória e flusha em lote a cada 30s
// (era 1 write no Mongo por fala de OC — inaceitável em escala).
const ocCountBuffer = new Map<string, number>();

function bumpOCMessageCount(ocId: string): void {
    ocCountBuffer.set(ocId, (ocCountBuffer.get(ocId) ?? 0) + 1);
}

async function flushOCMessageCounts(): Promise<void> {
    if (ocCountBuffer.size === 0) return;
    const ops = Array.from(ocCountBuffer.entries()).map(([id, n]) => ({
        updateOne: { filter: { _id: id }, update: { $inc: { messageCount: n } } },
    }));
    ocCountBuffer.clear();
    try {
        await OCModel.bulkWrite(ops as any, { ordered: false });
    } catch (e) {
        console.error('❌ [OC] Falha no flush do messageCount:', e);
    }
}

setInterval(() => { flushOCMessageCounts().catch(() => null); }, 30_000).unref();

export async function handleOCMessage(message: Message): Promise<boolean> {
    if (message.author.bot) return false;
    if (!message.guild) return false;

    // Curto-circuito: se o autor não tem NENHUM OC, nem toca no Mongo.
    // (Era 1 find() por mensagem em todos os servidores — o teto de escala do bot.)
    if (!userHasOC(message.author.id)) return false;

    const myOCs = await OCModel.find({
        $or: [
            { adminId: message.author.id },
            { duoIds: message.author.id }
        ]
    });

    if (!myOCs.length) return false;

    const ocs = myOCs
        .filter(oc => oc.prefix || oc.suffix)
        // Prefixo mais longo primeiro ("??:" ganha de "?:"); empate exato entre
        // OCs do MESMO autor → o mais antigo vence (determinístico, antes era
        // ordem arbitrária do Mongo).
        .sort((a, b) =>
            (b.prefix?.length || 0) - (a.prefix?.length || 0) ||
            (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));

    const messagesToSend: { oc: IOC, cleanContent: string }[] = [];
    let contentToParse = message.content.trim();


    while (contentToParse.length > 0) {
        let matchedOC: IOC | null = null;
        let matchText = "";
        let remainingText = "";

        for (const oc of ocs) {
            const prefix = oc.prefix || "";
            const suffix = oc.suffix || "";

            if (contentToParse.startsWith(prefix)) {
                if (suffix) {
                    const suffixIndex = contentToParse.indexOf(suffix, prefix.length);
                    if (suffixIndex !== -1) {
                        matchedOC = oc;
                        matchText = contentToParse.substring(prefix.length, suffixIndex).trim();
                        remainingText = contentToParse.substring(suffixIndex + suffix.length).trim();
                        break;
                    }
                } else {
                    matchedOC = oc;
                    let endIndex = contentToParse.length;
                    
                    const lines = contentToParse.substring(prefix.length).split('\n');
                    let accumulatedLength = prefix.length;

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (i > 0) { 
                            const possibleNextOC = ocs.find(o => o.prefix && line.trimStart().startsWith(o.prefix));
                            if (possibleNextOC) {
                                endIndex = accumulatedLength;
                                break;
                            }
                        }
                        accumulatedLength += line.length + (i < lines.length - 1 ? 1 : 0); 
                    }

                    matchText = contentToParse.substring(prefix.length, endIndex).trim();
                    remainingText = contentToParse.substring(endIndex).trim();
                    break;
                }
            }
        }

        if (matchedOC) {
            messagesToSend.push({ oc: matchedOC, cleanContent: matchText });
            contentToParse = remainingText;
        } else {
            const nextNewline = contentToParse.indexOf('\n');
            if (nextNewline !== -1) {
                contentToParse = contentToParse.substring(nextNewline + 1).trimStart();
            } else {
                break;
            }
        }
    }

    if (messagesToSend.length === 0) return false;

    // ⚠️ REMOVIDO (12/07/2026): o antigo "conflito de prefixo" global. Ele buscava
    // OCs de QUALQUER usuário do bot com o mesmo prefixo e, se o dono rival
    // estivesse no members.cache do servidor com um OC mais antigo, descartava a
    // mensagem EM SILÊNCIO (sem aviso — só console.log). Dois defeitos fatais:
    //   1. O proxy só casa OCs do AUTOR da mensagem (myOCs) — o prefixo de um
    //      estranho nunca é ambíguo; a checagem só quebrava proxies legítimos.
    //   2. members.cache é varrido de hora em hora (sweepers) → o conflito
    //      disparava aleatoriamente ("antes funcionava, agora não").
    // Empate entre OCs do PRÓPRIO autor já é resolvido no sort acima.
    const validMessages = messagesToSend;

    // Disparo dos Webhooks
    try {
        let targetChannel = message.channel;
        let threadId: string | undefined = undefined;

        if (targetChannel.isThread()) {
            threadId = targetChannel.id;
            targetChannel = targetChannel.parent as TextChannel;
        }

        if (!targetChannel || !('fetchWebhooks' in targetChannel)) return false;

        const webhook = await getOrCreateProxyWebhook(targetChannel as TextChannel);
        const channelIds = threadId ? [threadId, targetChannel.id] : [targetChannel.id];

        const filesToSend = Array.from(message.attachments.values()).map(attachment => attachment.url);

        const replyEmbed = await buildReplyEmbed(message);

        for (let i = 0; i < validMessages.length; i++) {
            const item = validMessages[i];
            const match = item.oc;

            // Filtros externos (ex: censura) transformam a fala do personagem antes do envio
            const filteredContent = await applyContentFilters(message.guild.id, channelIds, item.cleanContent);

            const sent = await webhook.send({
                content: sanitizeOutput(filteredContent) || "\u200B",
                username: match.name,
                avatarURL: match.avatar,
                files: i === 0 ? filesToSend : [],
                embeds: i === 0 && replyEmbed ? [replyEmbed] : [],
                threadId: threadId
            });

            // Guarda quem enviou este proxy, pra permitir apagar reagindo \u274C.
            if (sent?.id) rememberOCMessage(sent.id, message.author.id);

            // messageCount é métrica, não dado crítico: acumula em memória e
            // flusha em lote (era 1 write no Mongo por fala de OC).
            bumpOCMessageCount(String(match._id));
            // Estatísticas do OC são contabilizadas em commandCheckout.trackWebhookStats
            // (pela mensagem de webhook reenviada), por nome — não duplicar aqui.
        }

        rememberProxiedOriginal(message.id);
        message.delete().catch(() => {});

        return true;

    } catch (e) {
        console.error("Erro no webhook:", e);
        return false;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  Apagar proxy de OC reagindo ❌ (estilo Tupperbox) — só o AUTOR, só webhook nossa
// ═════════════════════════════════════════════════════════════════════════════

// messageId → id de quem digitou o proxy. Cap de tamanho pra não vazar memória.
const recentOCMessages = new Map<string, string>();
const OC_MSG_CACHE_CAP = 5000;

export function rememberOCMessage(messageId: string, userId: string): void {
    recentOCMessages.set(messageId, userId);
    if (recentOCMessages.size > OC_MSG_CACHE_CAP) {
        const oldest = recentOCMessages.keys().next().value; // Map preserva ordem de inserção
        if (oldest) recentOCMessages.delete(oldest);
    }
}

// Cache "esta webhook é minha?" (webhookId → boolean) pra não refazer o fetch.
const ownWebhookCache = new Map<string, boolean>();

async function isOwnWebhook(msg: Message | PartialMessage): Promise<boolean> {
    const id = msg.webhookId;
    if (!id) return false;
    if (ownWebhookCache.has(id)) return ownWebhookCache.get(id)!;
    try {
        const wh = await msg.client.fetchWebhook(id);
        const mine = wh.owner?.id === msg.client.user?.id;
        ownWebhookCache.set(id, mine);
        return mine;
    } catch {
        ownWebhookCache.set(id, false);
        return false;
    }
}

// Emojis aceitos como "apagar".
const DELETE_EMOJIS = new Set(['❌', '❎', '✖️', '✖', '🗑️', '🗑']);

async function handleOCReactionDelete(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
): Promise<void> {
    if (user.bot) return;
    if (!DELETE_EMOJIS.has(reaction.emoji.name ?? '')) return;

    // Resolve partials (reações em mensagens fora do cache chegam parciais).
    if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
    let msg: Message | PartialMessage = reaction.message;
    if (msg.partial) { try { msg = await msg.fetch(); } catch { return; } }

    if (!msg.webhookId || !msg.guild) return; // só mensagens de webhook, em servidor

    // 1) Caminho exato: proxy que ESTE bot enviou recentemente (autor conhecido).
    const typedBy = recentOCMessages.get(msg.id);
    let allowed = false;

    if (typedBy) {
        allowed = typedBy === user.id;
    } else {
        // 2) Fallback durável (sobrevive a restart): a webhook é nossa E quem reagiu
        //    é dono de um OC com o nome exibido na mensagem.
        if (!(await isOwnWebhook(msg))) return;
        const displayName = msg.author?.username;
        if (!displayName) return;
        const oc = await OCModel.findOne({
            name: displayName,
            $or: [{ adminId: user.id }, { duoIds: user.id }],
        }).collation({ locale: 'pt', strength: 2 });
        allowed = !!oc;
    }

    if (!allowed) return;

    await msg.delete().catch(() => {});
    recentOCMessages.delete(msg.id);
}

// ─── Auto-inscrição no EventCheckout ─────────────────────────────────────────
// Proxy de OC (tupper): toda mensagem cujo conteúdo começa com o prefixo de um
// personagem do autor é reenviada via webhook (nome + avatar do OC) e a original
// é apagada. handleOCMessage já filtra bots/DMs e devolve boolean.
EventCheckout.onMessageCreate('oc:proxy', (msg: Message) => handleOCMessage(msg));

// Editar uma mensagem PARA um prefixo de OC também dispara o proxy.
// Seguro contra duplicação: se a original já tivesse casado um prefixo, ela teria
// sido apagada no create — então uma mensagem que ainda existe pra ser editada
// nunca foi proxiada antes.
EventCheckout.onMessageUpdate('oc:proxy:edit', async (_old, cur) => {
    let msg: Message | PartialMessage = cur;
    if (msg.partial) { try { msg = await msg.fetch(); } catch { return; } }
    await handleOCMessage(msg as Message);
});

// Deleção do proxy por reação ❌ (só o autor / co-dono, só webhook do RPTool).
EventCheckout.onMessageReactionAdd('oc:reactionDelete', (r, u) => handleOCReactionDelete(r, u));