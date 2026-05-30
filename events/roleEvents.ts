// RPTool/events/roleEvents.ts
// ─── Intent: GUILDS (1 << 0) — Cargos ────────────────────────────────────────
// Eventos: GUILD_ROLE_CREATE · GUILD_ROLE_UPDATE · GUILD_ROLE_DELETE
// Subscribers de log: supercommands/logs/events/GuildLogs.ts

import { EventCheckout } from '../tools/event_checkout';
import { Role } from 'discord.js';

EventCheckout.onGuildRoleCreate('roleEvents:central', async (_role: Role) => {});
EventCheckout.onGuildRoleUpdate('roleEvents:central', async (_old: Role, _new: Role) => {});
EventCheckout.onGuildRoleDelete('roleEvents:central', async (_role: Role) => {});
