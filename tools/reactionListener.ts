import { MessageReaction, User, PartialMessageReaction, PartialUser } from "discord.js";
import { ReactionRoleModel } from "./models/ReactionRoleSchema";

export async function handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (user.partial) await user.fetch().catch(() => {});

    const emojiIdOrName = reaction.emoji.id || reaction.emoji.name;
    if (!emojiIdOrName) return;

    const rr = await ReactionRoleModel.findOne({
        messageId: reaction.message.id,
        emoji: emojiIdOrName
    });

    if (!rr) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(rr.roleId);
    if (role) {
        await member.roles.add(role).catch(() => console.error("Sem permissão para dar o cargo!"));
    }
}

export async function handleReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (user.partial) await user.fetch().catch(() => {});

    const emojiIdOrName = reaction.emoji.id || reaction.emoji.name;
    if (!emojiIdOrName) return;

    const rr = await ReactionRoleModel.findOne({
        messageId: reaction.message.id,
        emoji: emojiIdOrName
    });

    if (!rr) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(rr.roleId);
    if (role) {
        await member.roles.remove(role).catch(() => console.error("Sem permissão para tirar o cargo!"));
    }
}