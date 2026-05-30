// RPTool/supercommands/logs/events/ReactionLogs.ts
// ─── Log: Reações ─────────────────────────────────────────────────────────────
// Intent: GUILD_MESSAGE_REACTIONS (1 << 10)
// Eventos: MESSAGE_REACTION_ADD · MESSAGE_REACTION_REMOVE
//          MESSAGE_REACTION_REMOVE_ALL · MESSAGE_REACTION_REMOVE_EMOJI
//
// ⚠️ VOLUME ALTO — desativado por padrão na categoria.
//    Para ativar: rp!logs categoria reactions on
//    (requer adicionar 'reactions' em LOG_CATEGORIES no index.ts do logs)
//
// Caso de uso principal: servidores de RP com reaction roles customizados,
// ou staff investigando manipulação de enquetes/votações.

import {
    MessageReaction, PartialMessageReaction,
    User, PartialUser,
    Message, PartialMessage,
    Collection,
    EmbedBuilder,
} from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, truncate } from '../utils/LogMinister';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emojiDisplay(reaction: MessageReaction | PartialMessageReaction): string {
    const e = reaction.emoji;
    return e.id
        ? `<${e.animated ? 'a' : ''}:${e.name}:${e.id}> (\`:${e.name}:\`)`
        : (e.name ?? '?');
}

async function resolveReaction(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
): Promise<{ reaction: MessageReaction; user: User } | null> {
    try {
        const r = reaction.partial ? await reaction.fetch() : reaction;
        const u = user.partial     ? await user.fetch()     : user;
        return { reaction: r as MessageReaction, user: u as User };
    } catch {
        return null;
    }
}

// ─── Reaction Add ─────────────────────────────────────────────────────────────
EventCheckout.onMessageReactionAdd('logs:reactionAdd', async (
    rawReaction: MessageReaction | PartialMessageReaction,
    rawUser:     User | PartialUser,
) => {
    if (!rawReaction.message.guildId) return;

    const resolved = await resolveReaction(rawReaction, rawUser);
    if (!resolved) return;
    const { reaction, user } = resolved;
    if (user.bot) return;

    const guild = reaction.message.guild!;
    const lm    = await LogMinister.for(guild);
    // Categoria 'reactions' — opt-in, desativada por padrão
    if (!lm || !lm.allows('reactions' as any)) return;

    const msg        = reaction.message as Message;
    const msgAuthor  = msg.author?.tag ?? 'Desconhecido';
    const msgContent = truncate(msg.content || '*(sem texto)*', 200);
    const jumpUrl    = msg.url;

    const embed = new EmbedBuilder()
        .setColor(LogColor.join)
        .setAuthor({
            name:    user.tag,
            iconURL: user.displayAvatarURL({ size: 64 }),
        })
        .setDescription(`**${user.tag}** reagiu com ${emojiDisplay(reaction)} numa mensagem de **${msgAuthor}**`)
        .addFields(
            { name: 'Canal',         value: `<#${reaction.message.channelId}>`, inline: true },
            { name: 'Reação',        value: emojiDisplay(reaction), inline: true },
            { name: 'Total',         value: String(reaction.count ?? 1), inline: true },
            { name: 'Mensagem',      value: `${msgContent}\n[Ir para a mensagem](${jumpUrl})` },
        )
        .addFields({
            name:  '\u200B',
            value: idBlock({ User: user.id, Message: reaction.message.id }),
        })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Reaction Remove ──────────────────────────────────────────────────────────
EventCheckout.onMessageReactionRemove('logs:reactionRemove', async (
    rawReaction: MessageReaction | PartialMessageReaction,
    rawUser:     User | PartialUser,
) => {
    if (!rawReaction.message.guildId) return;

    const resolved = await resolveReaction(rawReaction, rawUser);
    if (!resolved) return;
    const { reaction, user } = resolved;
    if (user.bot) return;

    const guild = reaction.message.guild!;
    const lm    = await LogMinister.for(guild);
    if (!lm || !lm.allows('reactions' as any)) return;

    const msg     = reaction.message as Message;
    const jumpUrl = msg.url;

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setAuthor({
            name:    user.tag,
            iconURL: user.displayAvatarURL({ size: 64 }),
        })
        .setDescription(`**${user.tag}** removeu a reação ${emojiDisplay(reaction)}`)
        .addFields(
            { name: 'Canal',   value: `<#${reaction.message.channelId}>`, inline: true },
            { name: 'Reação',  value: emojiDisplay(reaction), inline: true },
            { name: 'Total restante', value: String(reaction.count ?? 0), inline: true },
            { name: 'Mensagem', value: `[Ir para a mensagem](${jumpUrl})` },
        )
        .addFields({
            name:  '\u200B',
            value: idBlock({ User: user.id, Message: reaction.message.id }),
        })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Reaction Remove All (todas as reações de uma mensagem) ───────────────────
// Geralmente feito por um moderador via "Remover todas as reações".
EventCheckout.onMessageReactionRemoveAll('logs:reactionRemoveAll', async (
    msg: Message | PartialMessage,
    reactions: Collection<string, MessageReaction>,
) => {
    if (!msg.guildId) return;

    const guild = msg.guild!;
    const lm    = await LogMinister.for(guild);
    if (!lm || !lm.allows('reactions' as any)) return;

    const emojiList = [...reactions.values()]
        .map(r => `${emojiDisplay(r)} (${r.count})`)
        .join(', ');

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`🧹 **Todas as reações** foram removidas de uma mensagem em <#${msg.channelId}>`)
        .addFields(
            { name: 'Reações removidas', value: truncate(emojiList || '*(sem dados)*') },
            { name: 'Mensagem',          value: `[Ir para a mensagem](${msg.url})` },
        )
        .addFields({
            name:  '\u200B',
            value: idBlock({ Message: msg.id, Channel: msg.channelId ?? '?' }),
        })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Reaction Remove Emoji (todas as reações de UM emoji específico) ──────────
// Ocorre quando um moderador remove um emoji específico de uma mensagem.
EventCheckout.onMessageReactionRemoveEmoji('logs:reactionRemoveEmoji', async (
    reaction: MessageReaction | PartialMessageReaction,
) => {
    if (!reaction.message.guildId) return;

    const guild = reaction.message.guild!;
    const lm    = await LogMinister.for(guild);
    if (!lm || !lm.allows('reactions' as any)) return;

    const msg = reaction.message;

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`🧹 O emoji ${emojiDisplay(reaction)} foi removido de todos os usuários em <#${msg.channelId}>`)
        .addFields(
            { name: 'Emoji',      value: emojiDisplay(reaction), inline: true },
            { name: 'Mensagem',   value: `[Ir para a mensagem](${msg.url})` },
        )
        .addFields({
            name:  '\u200B',
            value: idBlock({ Message: msg.id, Channel: msg.channelId ?? '?' }),
        })
        .setTimestamp();

    await lm.send(embed);
});
