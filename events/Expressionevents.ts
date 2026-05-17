// RPTool/events/expressionEvents.ts
// ─── Intent: GUILD_EXPRESSIONS (1 << 3) ──────────────────────────────────────
// Cobre: GUILD_EMOJIS_UPDATE · GUILD_STICKERS_UPDATE
//        GUILD_SOUNDBOARD_SOUND_CREATE/UPDATE/DELETE/SOUNDS_UPDATE
import {
    Events,
    Guild,
    GuildEmoji,
    Sticker,
    Collection,
    Snowflake,
    Client,
} from 'discord.js';

export default [

    // ── GUILD_EMOJIS_UPDATE ───────────────────────────────────────────────────
    // Discord.js agrupa criação/edição/deleção de emoji neste único evento
    { name: Events.GuildEmojiCreate, once: false,
      execute: async (_emoji: GuildEmoji, _client: Client) => {
        // TODO: supercommands/logs/events/expressionLogs.ts → onEmojiCreate
      }},

    { name: Events.GuildEmojiUpdate, once: false,
      execute: async (_old: GuildEmoji, _new: GuildEmoji, _client: Client) => {
        // TODO: supercommands/logs/events/expressionLogs.ts → onEmojiUpdate
      }},

    { name: Events.GuildEmojiDelete, once: false,
      execute: async (_emoji: GuildEmoji, _client: Client) => {
        // TODO: supercommands/logs/events/expressionLogs.ts → onEmojiDelete
      }},

    // ── GUILD_STICKERS_UPDATE ─────────────────────────────────────────────────
    { name: Events.GuildStickerCreate, once: false,
      execute: async (_sticker: Sticker, _client: Client) => {
        // TODO: supercommands/logs/events/expressionLogs.ts → onStickerCreate
      }},

    { name: Events.GuildStickerUpdate, once: false,
      execute: async (_old: Sticker, _new: Sticker, _client: Client) => {
        // TODO: supercommands/logs/events/expressionLogs.ts → onStickerUpdate
      }},

    { name: Events.GuildStickerDelete, once: false,
      execute: async (_sticker: Sticker, _client: Client) => {
        // TODO: supercommands/logs/events/expressionLogs.ts → onStickerDelete
      }},

    // ── GUILD_SOUNDBOARD_SOUND_* ──────────────────────────────────────────────

    { name: 'soundboardSoundCreate', once: false,
    execute: async (_sound: any, _client: Client) => {
    //     // TODO: supercommands/logs/events/expressionLogs.ts → onSoundCreate
    }},

    { name: 'soundboardSoundUpdate', once: false,
    execute: async (_old: any, _new: any, _client: Client) => {
    //     // TODO: supercommands/logs/events/expressionLogs.ts → onSoundUpdate
    }},

    { name: 'soundboardSoundDelete', once: false,
    execute: async (_sound: any, _client: Client) => {
    //     // TODO: supercommands/logs/events/expressionLogs.ts → onSoundDelete
    }},
];