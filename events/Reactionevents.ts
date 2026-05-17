// RPTool/events/reactionEvents.ts
// ─── Intents ──────────────────────────────────────────────────────────────────
// GUILD_MESSAGE_REACTIONS  (1 << 10): reaction add/remove em servidores
// DIRECT_MESSAGE_REACTIONS (1 << 13): reaction add/remove em DMs
//
// ⚠️ FIX: importações corrigidas de interaction_checkout → reactionListener
//    interaction_checkout não exporta handleReactionAdd/handleReactionRemove;
//    essas funções vivem em tools/reactionListener.ts
import {
    Events,
    MessageReaction,
    PartialMessageReaction,
    User,
    PartialUser,
    Client,
} from 'discord.js';
import { handleReactionAdd, handleReactionRemove } from '../tools/reactionListener';

export default [

    // ── MESSAGE_REACTION_ADD ──────────────────────────────────────────────────
    {
        name:  Events.MessageReactionAdd,
        once:  false,
        execute: async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, _client: Client) => {
            await handleReactionAdd(reaction, user);
            // TODO: supercommands/logs/events/messageLogs.ts → onReactionAdd
        },
    },

    // ── MESSAGE_REACTION_REMOVE ───────────────────────────────────────────────
    {
        name:  Events.MessageReactionRemove,
        once:  false,
        execute: async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, _client: Client) => {
            await handleReactionRemove(reaction, user);
            // TODO: supercommands/logs/events/messageLogs.ts → onReactionRemove
        },
    },

    // ── MESSAGE_REACTION_REMOVE_ALL ───────────────────────────────────────────
    {
        name:  Events.MessageReactionRemoveAll,
        once:  false,
        execute: async (_reaction: MessageReaction | PartialMessageReaction, _client: Client) => {
            // TODO: todas as reações de uma mensagem removidas de uma vez
        },
    },

    // ── MESSAGE_REACTION_REMOVE_EMOJI ─────────────────────────────────────────
    {
        name:  Events.MessageReactionRemoveEmoji,
        once:  false,
        execute: async (_reaction: MessageReaction | PartialMessageReaction, _client: Client) => {
            // TODO: um emoji específico removido de todas as reações
        },
    },
];