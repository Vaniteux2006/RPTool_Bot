// RPTool/events/guildEvents.ts
// ─── Intent: GUILDS (1 << 0) — parte 1: servidor, canais, threads, stage ─────
// Cobre:
//   GUILD_CREATE · GUILD_UPDATE · GUILD_DELETE
//   CHANNEL_CREATE · CHANNEL_UPDATE · CHANNEL_DELETE · CHANNEL_PINS_UPDATE
//   THREAD_CREATE · THREAD_UPDATE · THREAD_DELETE · THREAD_LIST_SYNC
//   THREAD_MEMBER_UPDATE · THREAD_MEMBERS_UPDATE
//   STAGE_INSTANCE_CREATE · STAGE_INSTANCE_UPDATE · STAGE_INSTANCE_DELETE
//   VOICE_CHANNEL_STATUS_UPDATE
// Nota: roles ficam em roleEvents.ts (mesmo intent, arquivo separado por clareza)
import {
    Events,
    Guild,
    GuildChannel,
    DMChannel,
    NonThreadGuildBasedChannel,
    TextChannel,
    StageChannel,
    ThreadChannel,
    ThreadMember,
    Collection,
    Snowflake,
    StageInstance,
    Client,
} from 'discord.js';

export default [

    // ── GUILD_CREATE ──────────────────────────────────────────────────────────
    { name: Events.GuildCreate, once: false,
      execute: async (_guild: Guild, _client: Client) => {
        // Bot entrou em um novo servidor
        // TODO: supercommands/logs/events/guildLogs.ts → onGuildJoin
      }},

    // ── GUILD_UPDATE ──────────────────────────────────────────────────────────
    { name: Events.GuildUpdate, once: false,
      execute: async (_old: Guild, _new: Guild, _client: Client) => {
        // Configurações do servidor alteradas (nome, ícone, região, nível boost…)
        // TODO: supercommands/logs/events/guildLogs.ts → onGuildUpdate
      }},

    // ── GUILD_DELETE ──────────────────────────────────────────────────────────
    { name: Events.GuildDelete, once: false,
      execute: async (_guild: Guild, _client: Client) => {
        // Bot removido do servidor ou servidor deletado
        // TODO: supercommands/logs/events/guildLogs.ts → onGuildLeave
      }},

    // ── CHANNEL_CREATE ────────────────────────────────────────────────────────
    { name: Events.ChannelCreate, once: false,
      execute: async (_channel: NonThreadGuildBasedChannel, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onChannelCreate
      }},

    // ── CHANNEL_UPDATE ────────────────────────────────────────────────────────
    { name: Events.ChannelUpdate, once: false,
      execute: async (_old: DMChannel | NonThreadGuildBasedChannel, _new: DMChannel | NonThreadGuildBasedChannel, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onChannelUpdate
        // (nome, permissões, tópico, slowmode, nsfw…)
      }},

    // ── CHANNEL_DELETE ────────────────────────────────────────────────────────
    { name: Events.ChannelDelete, once: false,
      execute: async (_channel: DMChannel | NonThreadGuildBasedChannel, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onChannelDelete
      }},

    // ── CHANNEL_PINS_UPDATE ───────────────────────────────────────────────────
    { name: Events.ChannelPinsUpdate, once: false,
      execute: async (_channel: TextChannel | DMChannel, _time: Date | null, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onPinsUpdate
      }},

    // ── THREAD_CREATE ─────────────────────────────────────────────────────────
    { name: Events.ThreadCreate, once: false,
      execute: async (_thread: ThreadChannel, _newlyCreated: boolean, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onThreadCreate
      }},

    // ── THREAD_UPDATE ─────────────────────────────────────────────────────────
    { name: Events.ThreadUpdate, once: false,
      execute: async (_old: ThreadChannel | null, _new: ThreadChannel, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onThreadUpdate
      }},

    // ── THREAD_DELETE ─────────────────────────────────────────────────────────
    { name: Events.ThreadDelete, once: false,
      execute: async (_thread: ThreadChannel, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onThreadDelete
      }},

    // ── THREAD_LIST_SYNC ──────────────────────────────────────────────────────
    { name: Events.ThreadListSync, once: false,
      execute: async (_threads: Collection<Snowflake, ThreadChannel>, _client: Client) => {
        // Disparado quando o bot ganha acesso a um canal com threads existentes
        // Geralmente não precisa de log — só sincronização de cache
      }},

    // ── THREAD_MEMBER_UPDATE ──────────────────────────────────────────────────
    { name: Events.ThreadMemberUpdate, once: false,
      execute: async (_old: ThreadMember, _new: ThreadMember, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onThreadMemberUpdate
      }},

    // ── THREAD_MEMBERS_UPDATE ─────────────────────────────────────────────────
    // Requer BOTH GUILDS (1<<0) AND GUILD_MEMBERS (1<<1)
    { name: Events.ThreadMembersUpdate, once: false,
      execute: async (_added: Collection<Snowflake, ThreadMember>, _removed: Collection<Snowflake, ThreadMember>, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onThreadMembersUpdate
      }},

    // ── STAGE_INSTANCE_CREATE ─────────────────────────────────────────────────
    { name: Events.StageInstanceCreate, once: false,
      execute: async (_stage: StageInstance, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onStageCreate
      }},

    // ── STAGE_INSTANCE_UPDATE ─────────────────────────────────────────────────
    { name: Events.StageInstanceUpdate, once: false,
      execute: async (_old: StageInstance | null, _new: StageInstance, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onStageUpdate
      }},

    // ── STAGE_INSTANCE_DELETE ─────────────────────────────────────────────────
    { name: Events.StageInstanceDelete, once: false,
      execute: async (_stage: StageInstance, _client: Client) => {
        // TODO: supercommands/logs/events/guildLogs.ts → onStageDelete
      }},
];