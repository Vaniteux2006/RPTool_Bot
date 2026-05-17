// RPTool/supercommands/logs/events/scheduledEventLogs.ts
// Intent necessário: GUILD_SCHEDULED_EVENTS (1 << 16)
// ⚠️ NÃO IMPLEMENTADO
import { GuildScheduledEvent, PartialGuildScheduledEvent, GuildMember, User, Client } from 'discord.js';

export async function onScheduledEventCreate(_event: GuildScheduledEvent, _client: Client) {
    // TODO: nome, descrição, horário, local (canal de voz ou externo), criador (audit log)
}

export async function onScheduledEventUpdate(
    _old: GuildScheduledEvent | PartialGuildScheduledEvent | null,
    _new: GuildScheduledEvent,
    _client: Client,
) {
    // TODO: diff — horário alterado, status mudou (SCHEDULED → ACTIVE → COMPLETED/CANCELED)
    // Detectar quando o evento começa (ACTIVE) para notificar canal configurado
}

export async function onScheduledEventDelete(_event: GuildScheduledEvent | PartialGuildScheduledEvent, _client: Client) {
    // TODO: evento cancelado antes de começar — nome, horário previsto, quem cancelou
}

export async function onScheduledEventUserAdd(
    _event: GuildScheduledEvent | PartialGuildScheduledEvent,
    _user: GuildMember | User,
    _client: Client,
) {
    // TODO (opt-in): usuário marcou interesse — alto volume em eventos populares
}

export async function onScheduledEventUserRemove(
    _event: GuildScheduledEvent | PartialGuildScheduledEvent,
    _user: GuildMember | User,
    _client: Client,
) {
    // TODO (opt-in): usuário desmarcou interesse
}