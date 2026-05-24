// RPTool/events/guildEvents.ts
// ─── Intent: GUILDS (1 << 0) ─────────────────────────────────────────────────
// Eventos (servidor): GUILD_CREATE · GUILD_UPDATE · GUILD_DELETE
// Eventos (canais):   CHANNEL_CREATE · CHANNEL_UPDATE · CHANNEL_DELETE
//                     CHANNEL_PINS_UPDATE
// Eventos (threads):  THREAD_CREATE · THREAD_UPDATE · THREAD_DELETE
//                     THREAD_LIST_SYNC · THREAD_MEMBER_UPDATE · THREAD_MEMBERS_UPDATE
// Eventos (stage):    STAGE_INSTANCE_CREATE/UPDATE/DELETE
//
// Subscribers de log (stub):
//   supercommands/logs/events/GuildLogs.ts → todos os handlers acima
//
// Nota: GUILD_ROLE_* ficam em roleEvents.ts para melhor organização.

import { EventCheckout } from '../tools/event_checkout';
import {
    Guild, NonThreadGuildBasedChannel, DMChannel,
    ThreadChannel, ThreadMember, StageInstance, Collection, Snowflake,
} from 'discord.js';

// Servidor
EventCheckout.onGuildCreate('guildEvents:central', async (_guild: Guild) => {
    // TODO: inicializar configurações padrão ao entrar em um servidor novo
});
EventCheckout.onGuildUpdate('guildEvents:central', async (_old: Guild, _new: Guild) => {});
EventCheckout.onGuildDelete('guildEvents:central', async (_guild: Guild) => {
    // TODO: limpar dados do servidor do banco de dados ao ser expulso
});

// Canais
EventCheckout.onChannelCreate('guildEvents:central', async (_channel: NonThreadGuildBasedChannel) => {});
EventCheckout.onChannelUpdate('guildEvents:central', async (_old: any, _new: any) => {});
EventCheckout.onChannelDelete('guildEvents:central', async (_channel: DMChannel | NonThreadGuildBasedChannel) => {});
EventCheckout.onChannelPinsUpdate('guildEvents:central', async (_channel: any, _time: Date | null) => {});

// Threads
EventCheckout.onThreadCreate('guildEvents:central', async (_thread: ThreadChannel, _newlyCreated: boolean) => {});
EventCheckout.onThreadUpdate('guildEvents:central', async (_old: ThreadChannel | null, _new: ThreadChannel) => {});
EventCheckout.onThreadDelete('guildEvents:central', async (_thread: ThreadChannel) => {});
EventCheckout.onThreadMembersUpdate('guildEvents:central', async (_added: Collection<Snowflake, ThreadMember>, _removed: Collection<Snowflake, ThreadMember>, _thread: ThreadChannel) => {});

// Stage
EventCheckout.onStageInstanceCreate('guildEvents:central', async (_stage: StageInstance) => {});
EventCheckout.onStageInstanceUpdate('guildEvents:central', async (_old: StageInstance | null, _new: StageInstance) => {});
EventCheckout.onStageInstanceDelete('guildEvents:central', async (_stage: StageInstance) => {});
