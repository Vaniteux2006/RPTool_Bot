// RPTool/tools/event_checkout.ts
// ─── Dispatcher Central de Eventos ───────────────────────────────────────────
// ⚠️ FIX: Events.IntegrationCreate / IntegrationUpdate / IntegrationDelete
//    não existem no enum Events do discord.js v14.
//    Corrigido para string literals: 'integrationCreate' etc.
import {
    Client,
    Events,
    Message,
    PartialMessage,
    GuildMember,
    PartialGuildMember,
    Interaction,
    MessageReaction,
    PartialMessageReaction,
    User,
    PartialUser,
    Guild,
    Role,
    DMChannel,
    NonThreadGuildBasedChannel,
    ThreadChannel,
    ThreadMember,
    StageInstance,
    GuildBan,
    GuildAuditLogsEntry,
    GuildEmoji,
    Sticker,
    Integration,
    Invite,
    VoiceState,
    GuildScheduledEvent,
    PartialGuildScheduledEvent,
    AutoModerationRule,
    AutoModerationActionExecution,
    Collection,
    Snowflake,
} from 'discord.js';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type AnyFn = (...args: any[]) => Promise<boolean | void> | boolean | void;

interface HandlerEntry {
    name: string;
    fn:   AnyFn;
}

// ─── Registro interno ─────────────────────────────────────────────────────────
const registry = new Map<string, HandlerEntry[]>();

function subscribe(event: string, name: string, fn: AnyFn): void {
    if (!registry.has(event)) registry.set(event, []);
    const handlers = registry.get(event)!;
    if (!handlers.find(h => h.name === name)) {
        handlers.push({ name, fn });
        console.log(`🔗 [EventCheckout] "${name}" inscrito em "${event}"`);
    }
}

async function dispatch(event: string, ...args: any[]): Promise<void> {
    const handlers = registry.get(event);
    if (!handlers?.length) return;
    for (const { name, fn } of handlers) {
        try {
            await fn(...args);
        } catch (e) {
            console.error(`❌ [EventCheckout] Erro em "${name}" (${event}):`, e);
        }
    }
}

// ─── API pública ──────────────────────────────────────────────────────────────
export const EventCheckout = {

    // ── InteractionCreate ─────────────────────────────────────────────────────
    onInteractionCreate: (name: string, fn: (i: Interaction) => Promise<boolean | void>) =>
        subscribe(Events.InteractionCreate, name, fn),

    // ── GUILD_MESSAGES (1<<9) ─────────────────────────────────────────────────
    onMessageCreate: (name: string, fn: (msg: Message) => Promise<boolean | void>) =>
        subscribe(Events.MessageCreate, name, fn),

    onMessageUpdate: (name: string, fn: (old: Message | PartialMessage, cur: Message | PartialMessage) => Promise<void>) =>
        subscribe(Events.MessageUpdate, name, fn),

    onMessageDelete: (name: string, fn: (msg: Message | PartialMessage) => Promise<void>) =>
        subscribe(Events.MessageDelete, name, fn),

    onMessageBulkDelete: (name: string, fn: (msgs: Collection<Snowflake, Message | PartialMessage>) => Promise<void>) =>
        subscribe(Events.MessageBulkDelete, name, fn),

    // ── GUILD_MESSAGE_REACTIONS (1<<10) ───────────────────────────────────────
    onMessageReactionAdd: (name: string, fn: (r: MessageReaction | PartialMessageReaction, u: User | PartialUser) => Promise<void>) =>
        subscribe(Events.MessageReactionAdd, name, fn),

    onMessageReactionRemove: (name: string, fn: (r: MessageReaction | PartialMessageReaction, u: User | PartialUser) => Promise<void>) =>
        subscribe(Events.MessageReactionRemove, name, fn),

    onMessageReactionRemoveAll: (name: string, fn: (r: MessageReaction | PartialMessageReaction) => Promise<void>) =>
        subscribe(Events.MessageReactionRemoveAll, name, fn),

    onMessageReactionRemoveEmoji: (name: string, fn: (r: MessageReaction | PartialMessageReaction) => Promise<void>) =>
        subscribe(Events.MessageReactionRemoveEmoji, name, fn),

    // ── GUILD_MEMBERS (1<<1) privileged ──────────────────────────────────────
    onGuildMemberAdd: (name: string, fn: (m: GuildMember) => Promise<void>) =>
        subscribe(Events.GuildMemberAdd, name, fn),

    onGuildMemberRemove: (name: string, fn: (m: GuildMember | PartialGuildMember) => Promise<void>) =>
        subscribe(Events.GuildMemberRemove, name, fn),

    onGuildMemberUpdate: (name: string, fn: (old: GuildMember | PartialGuildMember, cur: GuildMember) => Promise<void>) =>
        subscribe(Events.GuildMemberUpdate, name, fn),

    // ── GUILDS (1<<0) — servidor ──────────────────────────────────────────────
    onGuildCreate: (name: string, fn: (g: Guild) => Promise<void>) =>
        subscribe(Events.GuildCreate, name, fn),

    onGuildUpdate: (name: string, fn: (old: Guild, cur: Guild) => Promise<void>) =>
        subscribe(Events.GuildUpdate, name, fn),

    onGuildDelete: (name: string, fn: (g: Guild) => Promise<void>) =>
        subscribe(Events.GuildDelete, name, fn),

    // ── GUILDS (1<<0) — canais ────────────────────────────────────────────────
    onChannelCreate: (name: string, fn: (c: NonThreadGuildBasedChannel) => Promise<void>) =>
        subscribe(Events.ChannelCreate, name, fn),

    onChannelUpdate: (name: string, fn: (old: DMChannel | NonThreadGuildBasedChannel, cur: DMChannel | NonThreadGuildBasedChannel) => Promise<void>) =>
        subscribe(Events.ChannelUpdate, name, fn),

    onChannelDelete: (name: string, fn: (c: DMChannel | NonThreadGuildBasedChannel) => Promise<void>) =>
        subscribe(Events.ChannelDelete, name, fn),

    onChannelPinsUpdate: (name: string, fn: (c: any, time: Date | null) => Promise<void>) =>
        subscribe(Events.ChannelPinsUpdate, name, fn),

    // ── GUILDS (1<<0) — threads ───────────────────────────────────────────────
    onThreadCreate: (name: string, fn: (t: ThreadChannel, newlyCreated: boolean) => Promise<void>) =>
        subscribe(Events.ThreadCreate, name, fn),

    onThreadUpdate: (name: string, fn: (old: ThreadChannel | null, cur: ThreadChannel) => Promise<void>) =>
        subscribe(Events.ThreadUpdate, name, fn),

    onThreadDelete: (name: string, fn: (t: ThreadChannel) => Promise<void>) =>
        subscribe(Events.ThreadDelete, name, fn),

    onThreadMembersUpdate: (name: string, fn: (added: Collection<Snowflake, ThreadMember>, removed: Collection<Snowflake, ThreadMember>) => Promise<void>) =>
        subscribe(Events.ThreadMembersUpdate, name, fn),

    // ── GUILDS (1<<0) — cargos ────────────────────────────────────────────────
    onGuildRoleCreate: (name: string, fn: (r: Role) => Promise<void>) =>
        subscribe(Events.GuildRoleCreate, name, fn),

    onGuildRoleUpdate: (name: string, fn: (old: Role, cur: Role) => Promise<void>) =>
        subscribe(Events.GuildRoleUpdate, name, fn),

    onGuildRoleDelete: (name: string, fn: (r: Role) => Promise<void>) =>
        subscribe(Events.GuildRoleDelete, name, fn),

    // ── GUILDS (1<<0) — stage ─────────────────────────────────────────────────
    onStageInstanceCreate: (name: string, fn: (s: StageInstance) => Promise<void>) =>
        subscribe(Events.StageInstanceCreate, name, fn),

    onStageInstanceUpdate: (name: string, fn: (old: StageInstance | null, cur: StageInstance) => Promise<void>) =>
        subscribe(Events.StageInstanceUpdate, name, fn),

    onStageInstanceDelete: (name: string, fn: (s: StageInstance) => Promise<void>) =>
        subscribe(Events.StageInstanceDelete, name, fn),

    // ── GUILD_MODERATION (1<<2) ───────────────────────────────────────────────
    onGuildBanAdd: (name: string, fn: (b: GuildBan) => Promise<void>) =>
        subscribe(Events.GuildBanAdd, name, fn),

    onGuildBanRemove: (name: string, fn: (b: GuildBan) => Promise<void>) =>
        subscribe(Events.GuildBanRemove, name, fn),

    onGuildAuditLogEntryCreate: (name: string, fn: (entry: GuildAuditLogsEntry, guild: Guild) => Promise<void>) =>
        subscribe(Events.GuildAuditLogEntryCreate, name, fn),

    // ── GUILD_EXPRESSIONS (1<<3) ──────────────────────────────────────────────
    onGuildEmojiCreate: (name: string, fn: (e: GuildEmoji) => Promise<void>) =>
        subscribe(Events.GuildEmojiCreate, name, fn),

    onGuildEmojiUpdate: (name: string, fn: (old: GuildEmoji, cur: GuildEmoji) => Promise<void>) =>
        subscribe(Events.GuildEmojiUpdate, name, fn),

    onGuildEmojiDelete: (name: string, fn: (e: GuildEmoji) => Promise<void>) =>
        subscribe(Events.GuildEmojiDelete, name, fn),

    onGuildStickerCreate: (name: string, fn: (s: Sticker) => Promise<void>) =>
        subscribe(Events.GuildStickerCreate, name, fn),

    onGuildStickerUpdate: (name: string, fn: (old: Sticker, cur: Sticker) => Promise<void>) =>
        subscribe(Events.GuildStickerUpdate, name, fn),

    onGuildStickerDelete: (name: string, fn: (s: Sticker) => Promise<void>) =>
        subscribe(Events.GuildStickerDelete, name, fn),

    // ── GUILD_INTEGRATIONS (1<<4) + GUILD_WEBHOOKS (1<<5) ────────────────────
    onGuildIntegrationsUpdate: (name: string, fn: (g: Guild) => Promise<void>) =>
        subscribe(Events.GuildIntegrationsUpdate, name, fn),

    // FIX: string literals — Events.IntegrationCreate/Update/Delete não existem
    onIntegrationCreate: (name: string, fn: (i: Integration) => Promise<void>) =>
        subscribe('integrationCreate', name, fn),

    onIntegrationUpdate: (name: string, fn: (i: Integration) => Promise<void>) =>
        subscribe('integrationUpdate', name, fn),

    onIntegrationDelete: (name: string, fn: (i: Integration) => Promise<void>) =>
        subscribe('integrationDelete', name, fn),

    onWebhooksUpdate: (name: string, fn: (channel: any) => Promise<void>) =>
        subscribe(Events.WebhooksUpdate, name, fn),

    // ── GUILD_INVITES (1<<6) ──────────────────────────────────────────────────
    onInviteCreate: (name: string, fn: (i: Invite) => Promise<void>) =>
        subscribe(Events.InviteCreate, name, fn),

    onInviteDelete: (name: string, fn: (i: Invite) => Promise<void>) =>
        subscribe(Events.InviteDelete, name, fn),

    // ── GUILD_VOICE_STATES (1<<7) ─────────────────────────────────────────────
    onVoiceStateUpdate: (name: string, fn: (old: VoiceState, cur: VoiceState) => Promise<void>) =>
        subscribe(Events.VoiceStateUpdate, name, fn),

    // ── GUILD_SCHEDULED_EVENTS (1<<16) ────────────────────────────────────────
    onGuildScheduledEventCreate: (name: string, fn: (e: GuildScheduledEvent) => Promise<void>) =>
        subscribe(Events.GuildScheduledEventCreate, name, fn),

    onGuildScheduledEventUpdate: (name: string, fn: (old: GuildScheduledEvent | PartialGuildScheduledEvent | null, cur: GuildScheduledEvent) => Promise<void>) =>
        subscribe(Events.GuildScheduledEventUpdate, name, fn),

    onGuildScheduledEventDelete: (name: string, fn: (e: GuildScheduledEvent | PartialGuildScheduledEvent) => Promise<void>) =>
        subscribe(Events.GuildScheduledEventDelete, name, fn),

    onGuildScheduledEventUserAdd: (name: string, fn: (e: GuildScheduledEvent | PartialGuildScheduledEvent, u: GuildMember | User) => Promise<void>) =>
        subscribe(Events.GuildScheduledEventUserAdd, name, fn),

    onGuildScheduledEventUserRemove: (name: string, fn: (e: GuildScheduledEvent | PartialGuildScheduledEvent, u: GuildMember | User) => Promise<void>) =>
        subscribe(Events.GuildScheduledEventUserRemove, name, fn),

    // ── AUTO_MODERATION (1<<20 + 1<<21) ──────────────────────────────────────
    onAutoModerationRuleCreate: (name: string, fn: (r: AutoModerationRule) => Promise<void>) =>
        subscribe(Events.AutoModerationRuleCreate, name, fn),

    onAutoModerationRuleUpdate: (name: string, fn: (old: AutoModerationRule | null, cur: AutoModerationRule) => Promise<void>) =>
        subscribe(Events.AutoModerationRuleUpdate, name, fn),

    onAutoModerationRuleDelete: (name: string, fn: (r: AutoModerationRule) => Promise<void>) =>
        subscribe(Events.AutoModerationRuleDelete, name, fn),

    onAutoModerationActionExecution: (name: string, fn: (e: AutoModerationActionExecution) => Promise<void>) =>
        subscribe(Events.AutoModerationActionExecution, name, fn),

    // ── Utilitário de debug ───────────────────────────────────────────────────
    listSubscribers(): void {
        console.log('\n📋 [EventCheckout] Inscritos por evento:');
        for (const [event, handlers] of registry.entries()) {
            console.log(`  ${event}: ${handlers.map(h => h.name).join(', ')}`);
        }
    },
};

// ─── Inicialização ────────────────────────────────────────────────────────────
export function initEventCheckout(client: Client): void {
    const bind = (event: string) =>
        client.on(event, (...args: any[]) => dispatch(event, ...args));

    // Sempre registrados
    bind(Events.InteractionCreate);
    bind(Events.MessageCreate);
    bind(Events.MessageReactionAdd);
    bind(Events.MessageReactionRemove);
    bind(Events.GuildMemberAdd);
    bind(Events.GuildMemberRemove);

    // Sob demanda (dispatch() retorna imediatamente sem handlers)
    bind(Events.MessageUpdate);
    bind(Events.MessageDelete);
    bind(Events.MessageBulkDelete);
    bind(Events.MessageReactionRemoveAll);
    bind(Events.MessageReactionRemoveEmoji);
    bind(Events.GuildMemberUpdate);
    bind(Events.GuildCreate);
    bind(Events.GuildUpdate);
    bind(Events.GuildDelete);
    bind(Events.ChannelCreate);
    bind(Events.ChannelUpdate);
    bind(Events.ChannelDelete);
    bind(Events.ChannelPinsUpdate);
    bind(Events.ThreadCreate);
    bind(Events.ThreadUpdate);
    bind(Events.ThreadDelete);
    bind(Events.ThreadMembersUpdate);
    bind(Events.GuildRoleCreate);
    bind(Events.GuildRoleUpdate);
    bind(Events.GuildRoleDelete);
    bind(Events.StageInstanceCreate);
    bind(Events.StageInstanceUpdate);
    bind(Events.StageInstanceDelete);
    bind(Events.GuildBanAdd);
    bind(Events.GuildBanRemove);
    bind(Events.GuildAuditLogEntryCreate);
    bind(Events.GuildEmojiCreate);
    bind(Events.GuildEmojiUpdate);
    bind(Events.GuildEmojiDelete);
    bind(Events.GuildStickerCreate);
    bind(Events.GuildStickerUpdate);
    bind(Events.GuildStickerDelete);
    bind(Events.GuildIntegrationsUpdate);
    bind(Events.WebhooksUpdate);
    bind(Events.InviteCreate);
    bind(Events.InviteDelete);
    bind(Events.VoiceStateUpdate);
    bind(Events.GuildScheduledEventCreate);
    bind(Events.GuildScheduledEventUpdate);
    bind(Events.GuildScheduledEventDelete);
    bind(Events.GuildScheduledEventUserAdd);
    bind(Events.GuildScheduledEventUserRemove);
    bind(Events.AutoModerationRuleCreate);
    bind(Events.AutoModerationRuleUpdate);
    bind(Events.AutoModerationRuleDelete);
    bind(Events.AutoModerationActionExecution);

    // FIX: string literals para os três eventos de Integration
    bind('integrationCreate');
    bind('integrationUpdate');
    bind('integrationDelete');

    console.log('✅ [EventCheckout] Dispatcher inicializado.');
}