// RPTool/events/messageReactionAdd.ts
import { MessageReaction, User, PartialMessageReaction, PartialUser } from "discord.js";
import { OCModel } from "../tools/models/OCSchema";

export default async function onMessageReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;
    if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.emoji.name !== '❌') return;
    if (!reaction.message.webhookId) return;

    const webhookName = reaction.message.author?.username;
    if (!webhookName) return;

    const isOwner = await OCModel.exists({ adminId: user.id, name: webhookName });

    if (isOwner) {
        try { await reaction.message.delete(); } catch { }
    }
}