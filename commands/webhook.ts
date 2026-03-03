import { Message, TextChannel, Webhook } from "discord.js";
import { OCModel, IOC } from "../models/OCSchema";
import ServerStats from "../models/ServerStats";

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
        message.delete().catch(() => {}); 

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

        for (let i = 0; i < validMessages.length; i++) {
            const item = validMessages[i];
            const match = item.oc;
            
            await webhook.send({
                content: sanitizeOutput(item.cleanContent) || "\u200B", 
                username: match.name,
                avatarURL: match.avatar,
                files: i === 0 ? Array.from(message.attachments.values()) : [], 
                threadId: threadId 
            });

            match.messageCount += 1;
            match.save().catch(()=>{});

            const dateStr = new Date().toISOString().split('T')[0];
            const hour = new Date().getUTCHours();
            
            ServerStats.findOneAndUpdate(
                { guildId: message.guild.id, date: dateStr, hour },
                { $inc: { [`users.${match._id.toString()}`]: 1 } }, 
                { upsert: true }
            ).catch(() => {});
        }

        return true;

    } catch (e) {
        console.error("Erro no webhook:", e);
        return false;
    }
}