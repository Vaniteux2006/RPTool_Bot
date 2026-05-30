// RPTool/events/expressionEvents.ts
// ─── Intent: GUILD_EXPRESSIONS (1 << 3) ──────────────────────────────────────
// Eventos: GUILD_EMOJIS_UPDATE → GuildEmojiCreate/Update/Delete
//          GUILD_STICKERS_UPDATE → GuildStickerCreate/Update/Delete
//          GUILD_SOUNDBOARD_SOUND_CREATE/UPDATE/DELETE/SOUNDS_UPDATE
//
// ⚠️ Soundboard events usam string literals — sem enum no discord.js v14.
// Subscribers de log: supercommands/logs/events/Expressionlogs.ts

import { EventCheckout } from '../tools/event_checkout';
import { GuildEmoji, Sticker } from 'discord.js';

// Emojis
EventCheckout.onGuildEmojiCreate('expressionEvents:central', async (_emoji: GuildEmoji) => {});
EventCheckout.onGuildEmojiUpdate('expressionEvents:central', async (_old: GuildEmoji, _new: GuildEmoji) => {});
EventCheckout.onGuildEmojiDelete('expressionEvents:central', async (_emoji: GuildEmoji) => {});

// Stickers
EventCheckout.onGuildStickerCreate('expressionEvents:central', async (_sticker: Sticker) => {});
EventCheckout.onGuildStickerUpdate('expressionEvents:central', async (_old: Sticker, _new: Sticker) => {});
EventCheckout.onGuildStickerDelete('expressionEvents:central', async (_sticker: Sticker) => {});

// Soundboard
EventCheckout.onSoundboardSoundCreate('expressionEvents:central', async (_sound: any) => {});
EventCheckout.onSoundboardSoundUpdate('expressionEvents:central', async (_old: any, _new: any) => {});
EventCheckout.onSoundboardSoundDelete('expressionEvents:central', async (_sound: any) => {});
