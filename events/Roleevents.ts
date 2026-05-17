// RPTool/events/roleEvents.ts
// ─── Intent: GUILDS (1 << 0) — parte 2: cargos ───────────────────────────────
// Cobre: GUILD_ROLE_CREATE · GUILD_ROLE_UPDATE · GUILD_ROLE_DELETE
import {
    Events,
    Role,
    Client,
} from 'discord.js';

export default [

    // ── GUILD_ROLE_CREATE ─────────────────────────────────────────────────────
    { name: Events.GuildRoleCreate, once: false,
      execute: async (_role: Role, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onRoleCreate
        // Loga: nome, cor, permissões, quem criou (via audit log)
      }},

    // ── GUILD_ROLE_UPDATE ─────────────────────────────────────────────────────
    { name: Events.GuildRoleUpdate, once: false,
      execute: async (_old: Role, _new: Role, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onRoleUpdate
        // Loga: o que mudou (nome, cor, permissões, posição hierárquica)
      }},

    // ── GUILD_ROLE_DELETE ─────────────────────────────────────────────────────
    { name: Events.GuildRoleDelete, once: false,
      execute: async (_role: Role, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onRoleDelete
        // Loga: nome do cargo deletado, quem deletou (via audit log)
      }},
];