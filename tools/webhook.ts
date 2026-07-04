import {
    Message, PartialMessage, TextChannel, Webhook,
    MessageReaction, PartialMessageReaction, User, PartialUser,
} from "discord.js";
import { OCModel, IOC } from "./models/OCSchema";
import { EventCheckout } from "./eventCheckout";

function sanitizeOutput(text: string): string {
    if (!text) return text;
    return text
        .replace(/@everyone/g, '@everyоne') 
        .replace(/@here/g, '@hеre')        
        .replace(/<@&(\d+)>/g, '<@&\u200b$1>');
}

export async function handleOCMessage(message: Message): Promise<boolean> {
    if (message.author.bot) return false;
    if (!message.guild) return false;

    const myOCs = await OCModel.find({
        $or: [
            { adminId: message.author.id },
            { duoIds: message.author.id }
        ]
    });

    if (!myOCs.length) return false;

    const ocs = myOCs
        .filter(oc => oc.prefix || oc.suffix)
        .sort((a, b) => (b.prefix?.length || 0) - (a.prefix?.length || 0));

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

    const validMessages: { oc: IOC, cleanContent: string }[] = [];
    const guildMembers = message.guild.members.cache;

    for (const item of messagesToSend) {
        const match = item.oc;
        const prefixQuery = match.prefix ? match.prefix : { $in: [null, ""] };
        const suffixQuery = match.suffix ? match.suffix : { $in: [null, ""] };

        const conflicts = await OCModel.find({ 
            prefix: prefixQuery, 
            suffix: suffixQuery,
            _id: { $ne: match._id } 
        });

        let hasConflict = false;
        if (conflicts.length > 0) {
            for (const rival of conflicts) {
                const rivalIsHere = guildMembers.has(rival.adminId) || rival.duoIds.some(id => guildMembers.has(id));
                if (rivalIsHere && rival.createdAt < match.createdAt) {
                    console.log(`Conflito: ${match.name} perdeu para ${rival.name} (Mais antigo)`);
                    hasConflict = true;
                    break;
                }
            }
        }

        if (!hasConflict) {
            validMessages.push(item);
        }
    }

    if (validMessages.length === 0) return false;

    // Disparo dos Webhooks
    try {
        let targetChannel = message.channel;
        let threadId: string | undefined = undefined;

        if (targetChannel.isThread()) {
            threadId = targetChannel.id;
            targetChannel = targetChannel.parent as TextChannel;
        }

        if (!targetChannel || !('fetchWebhooks' in targetChannel)) return false;

        const webhooks = await targetChannel.fetchWebhooks();
        let webhook = webhooks.find(w => w.owner?.id === message.client.user?.id);

        if (!webhook) {
            webhook = await targetChannel.createWebhook({
                name: 'RPTool OC Proxy',
                avatar: message.client.user?.displayAvatarURL()
            });
        }

        const filesToSend = Array.from(message.attachments.values()).map(attachment => attachment.url);

        // Webhook n\u00E3o faz reply nativo \u2014 replicamos o contexto como um embed clic\u00E1vel
        // (estilo PluralKit/Tupperbox) s\u00F3 na primeira mensagem do lote.
        let replyEmbed: object | undefined;
        if (message.reference?.messageId) {
            try {
                const ref = await message.channel.messages.fetch(message.reference.messageId);
                const refAuthor = (ref.member?.displayName || ref.author.username);
                let snippet = (ref.content || "").replace(/\n/g, " ").trim();
                if (snippet.length > 100) snippet = snippet.slice(0, 100) + "\u2026";
                if (!snippet) {
                    snippet = ref.attachments.size > 0 ? "*(anexo)*" : (ref.embeds.length > 0 ? "*(embed)*" : "*(mensagem)*");
                }
                const jump = `https://discord.com/channels/${message.guild.id}/${ref.channelId}/${ref.id}`;
                replyEmbed = {
                    color: 0x4f545c,
                    author: {
                        name: `\u21A9\uFE0F ${refAuthor}`,
                        icon_url: ref.author.displayAvatarURL()
                    },
                    description: `**[Respondendo a:](${jump})** ${sanitizeOutput(snippet)}`
                };
            } catch {
                // Mensagem referenciada foi apagada ou n\u00E3o est\u00E1 acess\u00EDvel \u2014 segue sem o embed.
            }
        }

        for (let i = 0; i < validMessages.length; i++) {
            const item = validMessages[i];
            const match = item.oc;

            const sent = await webhook.send({
                content: sanitizeOutput(item.cleanContent) || "\u200B",
                username: match.name,
                avatarURL: match.avatar,
                files: i === 0 ? filesToSend : [],
                embeds: i === 0 && replyEmbed ? [replyEmbed] : [],
                threadId: threadId
            });

            // Guarda quem enviou este proxy, pra permitir apagar reagindo \u274C.
            if (sent?.id) rememberOCMessage(sent.id, message.author.id);

            match.messageCount += 1;
            match.save().catch(()=>{});
            // Estatísticas do OC são contabilizadas em commandCheckout.trackWebhookStats
            // (pela mensagem de webhook reenviada), por nome — não duplicar aqui.
        }

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

function rememberOCMessage(messageId: string, userId: string): void {
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