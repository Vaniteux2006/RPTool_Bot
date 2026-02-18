"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOCMessage = handleOCMessage;
const OCSchema_1 = require("../models/OCSchema");
const ServerStats_1 = __importDefault(require("../models/ServerStats"));
async function handleOCMessage(message) {
    if (message.author.bot)
        return;
    if (!message.guild)
        return;
    const content = message.content;
    const myOCs = await OCSchema_1.OCModel.find({
        $or: [
            { adminId: message.author.id },
            { duoIds: message.author.id }
        ]
    });
    if (!myOCs.length)
        return;
    let match = null;
    let cleanContent = "";
    myOCs.sort((a, b) => b.prefix.length - a.prefix.length);
    for (const oc of myOCs) {
        const hasPrefix = oc.prefix ? content.startsWith(oc.prefix) : true;
        const hasSuffix = oc.suffix ? content.endsWith(oc.suffix) : true;
        if (hasPrefix && hasSuffix && (oc.prefix || oc.suffix)) {
            match = oc;
            cleanContent = content.substring(oc.prefix.length, content.length - oc.suffix.length).trim();
            break;
        }
    }
    if (!match)
        return;
    const conflicts = await OCSchema_1.OCModel.find({
        prefix: match.prefix,
        suffix: match.suffix,
        _id: { $ne: match._id }
    });
    if (conflicts.length > 0) {
        const guildMembers = message.guild.members.cache;
        for (const rival of conflicts) {
            const rivalIsHere = guildMembers.has(rival.adminId) || rival.duoIds.some(id => guildMembers.has(id));
            if (rivalIsHere) {
                if (rival.createdAt < match.createdAt) {
                    console.log(`Conflito: ${match.name} perdeu para ${rival.name} (Mais antigo)`);
                    return;
                }
            }
        }
    }
    try {
        message.delete().catch(() => { });
        const channel = message.channel;
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(w => w.owner?.id === message.client.user?.id);
        if (!webhook) {
            webhook = await channel.createWebhook({
                name: 'RPTool OC Proxy',
                avatar: message.client.user?.displayAvatarURL()
            });
        }
        await webhook.send({
            content: cleanContent,
            username: match.name,
            avatarURL: match.avatar,
            files: Array.from(message.attachments.values())
        });
        match.messageCount += 1;
        match.save();
        const dateStr = new Date().toISOString().split('T')[0];
        const hour = new Date().getUTCHours();
        ServerStats_1.default.findOneAndUpdate({ guildId: message.guild.id, date: dateStr, hour }, { $inc: { [`users.${match._id.toString()}`]: 1 } }, { upsert: true }).catch(() => { });
    }
    catch (e) {
        console.error("Erro no webhook:", e);
    }
}
