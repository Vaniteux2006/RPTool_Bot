"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleReactionAdd = handleReactionAdd;
exports.handleReactionRemove = handleReactionRemove;
const ReactionRoleSchema_1 = require("./models/ReactionRoleSchema");
async function handleReactionAdd(reaction, user) {
    if (user.bot)
        return;
    if (reaction.partial)
        await reaction.fetch().catch(() => { });
    if (user.partial)
        await user.fetch().catch(() => { });
    const emojiIdOrName = reaction.emoji.id || reaction.emoji.name;
    if (!emojiIdOrName)
        return;
    const rr = await ReactionRoleSchema_1.ReactionRoleModel.findOne({
        messageId: reaction.message.id,
        emoji: emojiIdOrName
    });
    if (!rr)
        return;
    const guild = reaction.message.guild;
    if (!guild)
        return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member)
        return;
    const role = guild.roles.cache.get(rr.roleId);
    if (role) {
        await member.roles.add(role).catch(() => console.error("Sem permissão para dar o cargo!"));
    }
}
async function handleReactionRemove(reaction, user) {
    if (user.bot)
        return;
    if (reaction.partial)
        await reaction.fetch().catch(() => { });
    if (user.partial)
        await user.fetch().catch(() => { });
    const emojiIdOrName = reaction.emoji.id || reaction.emoji.name;
    if (!emojiIdOrName)
        return;
    const rr = await ReactionRoleSchema_1.ReactionRoleModel.findOne({
        messageId: reaction.message.id,
        emoji: emojiIdOrName
    });
    if (!rr)
        return;
    const guild = reaction.message.guild;
    if (!guild)
        return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member)
        return;
    const role = guild.roles.cache.get(rr.roleId);
    if (role) {
        await member.roles.remove(role).catch(() => console.error("Sem permissão para tirar o cargo!"));
    }
}
