// RPTool/events/inviteEvents.ts
// ─── Intent: GUILD_INVITES (1 << 6) ──────────────────────────────────────────
// Eventos: INVITE_CREATE · INVITE_DELETE
// Subscribers de log: supercommands/logs/events/Invitelogs.ts

import { EventCheckout } from '../tools/event_checkout';
import { Invite } from 'discord.js';

EventCheckout.onInviteCreate('inviteEvents:central', async (_invite: Invite) => {});
EventCheckout.onInviteDelete('inviteEvents:central', async (_invite: Invite) => {});
