// RPTool/events/messageEvents.ts
// ─── Intent: GUILD_MESSAGES (1 << 9) ─────────────────────────────────────────
// Cobre: MESSAGE_CREATE · MESSAGE_UPDATE · MESSAGE_DELETE · MESSAGE_DELETE_BULK
// Nota: MESSAGE_CONTENT (1 << 15) é necessário para ler o conteúdo das mensagens
import {
    Events,
    Message,
    PartialMessage,
    Collection,
    Snowflake,
    Client,
} from 'discord.js';

export default [

    // ── MESSAGE_CREATE ────────────────────────────────────────────────────────
    // O processamento principal de comandos já está no index.ts (client.on messageCreate).
    // Este handler cobre comportamentos adicionais que não são comandos.
    {
        name:  Events.MessageCreate,
        once:  false,
        execute: async (_message: Message, _client: Client) => {
            // Nenhuma ação ativa aqui por enquanto.
            // O roteamento de comandos (rp!...) fica no index.ts → command_checkout.ts.

            // ── LOG PLACEHOLDER ───────────────────────────────────────────────
            // TODO: supercommands/logs/events/messageLogs.ts → onMessageCreate
            // (ex: filtro de palavras, anti-spam, contagem de mensagens)
        },
    },

    // ── MESSAGE_UPDATE ────────────────────────────────────────────────────────
    {
        name:  Events.MessageUpdate,
        once:  false,
        execute: async (_old: Message | PartialMessage, _new: Message | PartialMessage, _client: Client) => {
            // ── LOG PLACEHOLDER ───────────────────────────────────────────────
            // TODO: supercommands/logs/events/messageLogs.ts → onMessageUpdate
            // Loga: conteúdo anterior vs novo (se message_content intent ativo)
        },
    },

    // ── MESSAGE_DELETE ────────────────────────────────────────────────────────
    {
        name:  Events.MessageDelete,
        once:  false,
        execute: async (_message: Message | PartialMessage, _client: Client) => {
            // ── LOG PLACEHOLDER ───────────────────────────────────────────────
            // TODO: supercommands/logs/events/messageLogs.ts → onMessageDelete
            // Loga: quem deletou (via audit log), conteúdo (se cacheado)
        },
    },

    // ── MESSAGE_DELETE_BULK ───────────────────────────────────────────────────
    {
        name:  Events.MessageBulkDelete,
        once:  false,
        execute: async (_messages: Collection<Snowflake, Message | PartialMessage>, _client: Client) => {
            // ── LOG PLACEHOLDER ───────────────────────────────────────────────
            // TODO: supercommands/logs/events/messageLogs.ts → onMessageBulkDelete
            // Loga: quantas mensagens, quem executou o purge, canal
        },
    },
];