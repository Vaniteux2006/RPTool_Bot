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

    const content = message.content;
    const myOCs = await OCModel.find({
        $or: [
            { adminId: message.author.id },
            { duoIds: message.author.id }
        ]
    });

    if (!myOCs.length) return false;

    let match: IOC | null = null;
    let cleanContent = "";

    myOCs.sort((a, b) => (b.prefix || "").length - (a.prefix || "").length);

    for (const oc of myOCs) {
        const hasPrefix = oc.prefix ? content.startsWith(oc.prefix) : true;
        const hasSuffix = oc.suffix ? content.endsWith(oc.suffix) : true;

        if (hasPrefix && hasSuffix && (oc.prefix || oc.suffix)) {
            match = oc;
            
            const prefixLen = oc.prefix ? oc.prefix.length : 0;
            const suffixLen = oc.suffix ? oc.suffix.length : 0;

            cleanContent = content.substring(
                prefixLen, 
                content.length - suffixLen
            ).trim();
            break; 
        }
    }

    if (!match) return false;
    
    const prefixQuery = match.prefix ? match.prefix : { $in: [null, ""] };
    const suffixQuery = match.suffix ? match.suffix : { $in: [null, ""] };

    const conflicts = await OCModel.find({ 
        prefix: prefixQuery, 
        suffix: suffixQuery,
        _id: { $ne: match._id } 
    });

    if (conflicts.length > 0) {
        const guildMembers = message.guild.members.cache; 
        
        for (const rival of conflicts) {
            const rivalIsHere = guildMembers.has(rival.adminId) || rival.duoIds.some(id => guildMembers.has(id));
            
            if (rivalIsHere) {
                if (rival.createdAt < match.createdAt) {
                    console.log(`Conflito: ${match.name} perdeu para ${rival.name} (Mais antigo)`);
                    return false; 
                }
            }
        }
    }

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

        await webhook.send({
            content: sanitizeOutput(cleanContent) || "\u200B", 
            username: match.name,
            avatarURL: match.avatar,
            files: Array.from(message.attachments.values()),
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

        return true;

    } catch (e) {
        console.error("Erro no webhook:", e);
        return false;
    }
}