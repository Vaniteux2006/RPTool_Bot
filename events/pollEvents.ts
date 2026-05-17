// RPTool/events/pollEvents.ts
// ─── Intents ──────────────────────────────────────────────────────────────────
// GUILD_MESSAGE_POLLS   (1 << 24): votos em enquetes de servidores
// DIRECT_MESSAGE_POLLS  (1 << 25): votos em enquetes de DMs
// Disponível a partir do Discord.js v14.14+ / API v10
import { Events, PollAnswer, User, Client } from 'discord.js';

export default [

    // ── MESSAGE_POLL_VOTE_ADD ─────────────────────────────────────────────────
    { name: Events.MessagePollVoteAdd, once: false,
      execute: async (_answer: PollAnswer, _userId: string, _client: Client) => {
        // TODO: nenhuma ação ativa prevista.
        // Possível uso futuro: enquetes de RP com resultado aplicado automaticamente.
        // TODO: supercommands/logs/events/messageLogs.ts → onPollVoteAdd (opt-in)
      }},

    // ── MESSAGE_POLL_VOTE_REMOVE ──────────────────────────────────────────────
    { name: Events.MessagePollVoteRemove, once: false,
      execute: async (_answer: PollAnswer, _userId: string, _client: Client) => {
        // TODO: supercommands/logs/events/messageLogs.ts → onPollVoteRemove (opt-in)
      }},
];