// RPTool/events/scheduledEventEvents.ts
// ─── Intent: GUILD_SCHEDULED_EVENTS (1 << 16) ────────────────────────────────
// Cobre: GUILD_SCHEDULED_EVENT_CREATE · UPDATE · DELETE
//        GUILD_SCHEDULED_EVENT_USER_ADD · USER_REMOVE
import {
    Events,
    GuildScheduledEvent,
    PartialGuildScheduledEvent,
    GuildMember,
    User,
    Client,
} from 'discord.js';

export default [

    { name: Events.GuildScheduledEventCreate, once: false,
      execute: async (_event: GuildScheduledEvent, _client: Client) => {
        // TODO: supercommands/logs/events/scheduledEventLogs.ts → onCreate
        // Possível uso ativo: anunciar criação de evento em canal dedicado
      }},

    { name: Events.GuildScheduledEventUpdate, once: false,
      execute: async (_old: GuildScheduledEvent | PartialGuildScheduledEvent | null, _new: GuildScheduledEvent, _client: Client) => {
        // TODO: supercommands/logs/events/scheduledEventLogs.ts → onUpdate
        // Detectar: evento iniciado (status ACTIVE), cancelado, horário alterado
      }},

    { name: Events.GuildScheduledEventDelete, once: false,
      execute: async (_event: GuildScheduledEvent | PartialGuildScheduledEvent, _client: Client) => {
        // TODO: supercommands/logs/events/scheduledEventLogs.ts → onDelete
      }},

    { name: Events.GuildScheduledEventUserAdd, once: false,
      execute: async (_event: GuildScheduledEvent | PartialGuildScheduledEvent, _user: GuildMember | User, _client: Client) => {
        // TODO: supercommands/logs/events/scheduledEventLogs.ts → onUserAdd
        // Usuário marcou interesse no evento
      }},

    { name: Events.GuildScheduledEventUserRemove, once: false,
      execute: async (_event: GuildScheduledEvent | PartialGuildScheduledEvent, _user: GuildMember | User, _client: Client) => {
        // TODO: supercommands/logs/events/scheduledEventLogs.ts → onUserRemove
      }},
];