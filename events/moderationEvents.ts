// RPTool/events/moderationEvents.ts
// ─── Intent: GUILD_MODERATION (1 << 2) ───────────────────────────────────────
// Cobre: GUILD_AUDIT_LOG_ENTRY_CREATE · GUILD_BAN_ADD · GUILD_BAN_REMOVE
import {
    Events,
    GuildBan,
    GuildAuditLogsEntry,
    Guild,
    Client,
} from 'discord.js';

export default [

    // ── GUILD_AUDIT_LOG_ENTRY_CREATE ──────────────────────────────────────────
    // ⚠️ Evento de altíssimo volume — cada ação moderada no servidor dispara um.
    // NÃO processar em loop ou com DB queries sem rate limiting implementado.
    { name: Events.GuildAuditLogEntryCreate, once: false,
      execute: async (_entry: GuildAuditLogsEntry, _guild: Guild, _client: Client) => {
        // TODO: supercommands/logs/events/moderationLogs.ts → onAuditLogEntry
        // Ponto central de auditoria: cobre kick, ban, role add/remove, channel edit…
        // IMPLEMENTAR COM CUIDADO: filtrar por action type antes de qualquer I/O
      }},

    // ── GUILD_BAN_ADD ─────────────────────────────────────────────────────────
    { name: Events.GuildBanAdd, once: false,
      execute: async (_ban: GuildBan, _client: Client) => {
        // TODO: supercommands/logs/events/moderationLogs.ts → onBanAdd
        // Loga: usuário banido, motivo (do audit log), moderador
      }},

    // ── GUILD_BAN_REMOVE ──────────────────────────────────────────────────────
    { name: Events.GuildBanRemove, once: false,
      execute: async (_ban: GuildBan, _client: Client) => {
        // TODO: supercommands/logs/events/moderationLogs.ts → onBanRemove
        // Loga: usuário desbanido, quem desbaniu
      }},
];