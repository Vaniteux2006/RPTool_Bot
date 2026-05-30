// RPTool/events/moderationEvents.ts
// ─── Intent: GUILD_MODERATION (1 << 2) ───────────────────────────────────────
// Eventos: GUILD_AUDIT_LOG_ENTRY_CREATE · GUILD_BAN_ADD · GUILD_BAN_REMOVE
//
// Subscribers de log: supercommands/logs/events/Moderationlogs.ts
//
// ⚠️ GUILD_AUDIT_LOG_ENTRY_CREATE: altíssimo volume.
//    NÃO processar sem filtro de action type primeiro.
//    Implementar apenas em Moderationlogs.ts com map de handlers por tipo.

import { EventCheckout } from '../tools/event_checkout';
import { GuildBan, GuildAuditLogsEntry, Guild } from 'discord.js';

EventCheckout.onGuildBanAdd('moderationEvents:central', async (_ban: GuildBan) => {});
EventCheckout.onGuildBanRemove('moderationEvents:central', async (_ban: GuildBan) => {});
EventCheckout.onGuildAuditLogEntryCreate('moderationEvents:central', async (_entry: GuildAuditLogsEntry, _guild: Guild) => {
    // ⚠️ Não implementar lógica aqui sem filtro de _entry.action primeiro
});
