// RPTool/tools/reactionListener.ts
// ─── Sistema de Reaction Roles ────────────────────────────────────────────────
// Antes, este arquivo era chamado diretamente pelo index.ts e pelo reactionEvents.ts.
// Agora ele se auto-inscreve via EventCheckout ao ser importado pelo index.ts.
// Não é mais necessário referenciá-lo no index.ts — basta garantir que o import
// ocorra (o loadCommands já puxa tudo de /tools/ indiretamente via comandos).
//
// Se quiser garantir o carregamento mesmo sem nenhum comando importá-lo,
// adicione no index.ts: import './tools/reactionListener';
import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
import { ReactionRoleModel } from './models/ReactionRoleSchema';
import { EventCheckout } from './event_checkout';

async function handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (user.partial)     await user.fetch().catch(() => {});

    const emojiIdOrName = reaction.emoji.id || reaction.emoji.name;
    if (!emojiIdOrName) return;

    const rr = await ReactionRoleModel.findOne({ messageId: reaction.message.id, emoji: emojiIdOrName });
    if (!rr) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(rr.roleId);
    if (role) await member.roles.add(role).catch(() => console.error('Sem permissão para dar o cargo!'));
}

async function handleReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (user.partial)     await user.fetch().catch(() => {});

    const emojiIdOrName = reaction.emoji.id || reaction.emoji.name;
    if (!emojiIdOrName) return;

    const rr = await ReactionRoleModel.findOne({ messageId: reaction.message.id, emoji: emojiIdOrName });
    if (!rr) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(rr.roleId);
    if (role) await member.roles.remove(role).catch(() => console.error('Sem permissão para tirar o cargo!'));
}

// ─── Auto-inscrição no EventCheckout ─────────────────────────────────────────
EventCheckout.onMessageReactionAdd('reactionRole', (r, u) => handleReactionAdd(r, u));
EventCheckout.onMessageReactionRemove('reactionRole', (r, u) => handleReactionRemove(r, u));

// Mantém as exportações para compatibilidade com código legado que ainda as importe
export { handleReactionAdd, handleReactionRemove };
