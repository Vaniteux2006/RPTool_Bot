// RPTool/events/reactionEvents.ts
// ─── Intent: GUILD_MESSAGE_REACTIONS (1 << 10) ───────────────────────────────
// Eventos: MESSAGE_REACTION_ADD · MESSAGE_REACTION_REMOVE
//          MESSAGE_REACTION_REMOVE_ALL · MESSAGE_REACTION_REMOVE_EMOJI
//
// Subscribers ativos:
//   tools/reactionListener.ts
//     → EventCheckout.onMessageReactionAdd('reactionRole', ...)
//     → EventCheckout.onMessageReactionRemove('reactionRole', ...)
//
// Subscribers de log (stub):
//   supercommands/logs/events/Messagelogs.ts (opt-in — volume alto)
//
// ⚠️ INTENTS REMOVIDOS: DIRECT_MESSAGE_REACTIONS (1 << 13) não está ativo.
//    Se precisar de reactions em DMs futuramente, adicione o intent e um
//    subscriber específico.

import { EventCheckout } from '../tools/event_checkout';
import { MessageReaction, PartialMessageReaction, Message, PartialMessage, Collection } from 'discord.js';

// Slot central — a lógica de reaction roles está em tools/reactionListener.ts
EventCheckout.onMessageReactionAdd('reactionEvents:central', async (_reaction: MessageReaction | PartialMessageReaction, _user: any) => {
    // Slot para lógica que não seja reaction roles.
});

EventCheckout.onMessageReactionRemove('reactionEvents:central', async (_reaction: MessageReaction | PartialMessageReaction, _user: any) => {
    // Slot para lógica que não seja reaction roles.
});

EventCheckout.onMessageReactionRemoveAll('reactionEvents:central', async (_msg: Message | PartialMessage, _reactions: Collection<string, MessageReaction>) => {
    // Todas as reações de uma mensagem removidas de uma vez.
});

EventCheckout.onMessageReactionRemoveEmoji('reactionEvents:central', async (_reaction: MessageReaction | PartialMessageReaction) => {
    // Um emoji específico removido de todas as mensagens.
});
