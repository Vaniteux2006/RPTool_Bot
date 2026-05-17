// RPTool/events/inviteEvents.ts
// ─── Intent: GUILD_INVITES (1 << 6) ──────────────────────────────────────────
// Cobre: INVITE_CREATE · INVITE_DELETE
import { Events, Invite, Client } from 'discord.js';

export default [

    { name: Events.InviteCreate, once: false,
      execute: async (_invite: Invite, _client: Client) => {
        // TODO: supercommands/logs/events/inviteLogs.ts → onInviteCreate
        // Loga: código, canal, criador, usos máximos, expiração
      }},

    { name: Events.InviteDelete, once: false,
      execute: async (_invite: Invite, _client: Client) => {
        // TODO: supercommands/logs/events/inviteLogs.ts → onInviteDelete
        // Loga: código deletado, quem deletou (via audit log)
      }},
];