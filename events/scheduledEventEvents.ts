// RPTool/events/scheduledEventEvents.ts
// ─── Intent: GUILD_SCHEDULED_EVENTS (1 << 16) ────────────────────────────────
// Eventos: GUILD_SCHEDULED_EVENT_CREATE · UPDATE · DELETE
//          GUILD_SCHEDULED_EVENT_USER_ADD · USER_REMOVE
//
// Subscribers de log: supercommands/logs/events/scheduledEventLogs.ts
// Possível uso ativo: anunciar evento criado em canal dedicado.

import { EventCheckout } from '../tools/event_checkout';
import {
    GuildScheduledEvent, PartialGuildScheduledEvent,
    GuildMember, User,
} from 'discord.js';

EventCheckout.onGuildScheduledEventCreate('scheduledEvents:central', async (_event: GuildScheduledEvent) => {
    // TODO ativo: anunciar em canal de eventos configurado
});

EventCheckout.onGuildScheduledEventUpdate('scheduledEvents:central', async (
    _old: GuildScheduledEvent | PartialGuildScheduledEvent | null,
    _new: GuildScheduledEvent,
) => {
    // Detectar: evento iniciado (status ACTIVE), cancelado, horário alterado
});

EventCheckout.onGuildScheduledEventDelete('scheduledEvents:central', async (
    _event: GuildScheduledEvent | PartialGuildScheduledEvent,
) => {});

EventCheckout.onGuildScheduledEventUserAdd('scheduledEvents:central', async (
    _event: GuildScheduledEvent | PartialGuildScheduledEvent,
    _user: GuildMember | User,
) => {});

EventCheckout.onGuildScheduledEventUserRemove('scheduledEvents:central', async (
    _event: GuildScheduledEvent | PartialGuildScheduledEvent,
    _user: GuildMember | User,
) => {});
