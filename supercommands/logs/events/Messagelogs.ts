// RPTool/supercommands/logs/events/messageLogs.ts
// ─── Log: Mensagens e Reações ─────────────────────────────────────────────────
// Intents necessários: GUILD_MESSAGES (1<<9) + MESSAGE_CONTENT (1<<15)
// ⚠️ NÃO IMPLEMENTADO — aguardando otimização de rate limit e cache
import { Message, PartialMessage, Collection, Snowflake, MessageReaction, User, Client } from 'discord.js';

export async function onMessageUpdate(_old: Message | PartialMessage, _new: Message | PartialMessage, _client: Client) {
    // TODO: embed com conteúdo anterior vs novo (se message_content disponível)
    // Ignorar: edições de bots, mensagens sem conteúdo (embeds/attachments)
    // Cache: manter últimas N mensagens editáveis por canal para ter o "before"
}

export async function onMessageDelete(_message: Message | PartialMessage, _client: Client) {
    // TODO: embed com conteúdo (se cacheado), autor, canal, quem deletou (audit log)
    // Ignorar: deleção de mensagens do próprio bot
}

export async function onMessageBulkDelete(_messages: Collection<Snowflake, Message | PartialMessage>, _client: Client) {
    // TODO: embed com quantidade, canal, quem executou o purge (audit log)
    // Opcional: upload de arquivo .txt com todas as mensagens deletadas
}

export async function onReactionAdd(_reaction: MessageReaction, _user: User, _client: Client) {
    // TODO (opt-in): log de reações adicionadas — muito ruidoso por padrão
}

export async function onReactionRemove(_reaction: MessageReaction, _user: User, _client: Client) {
    // TODO (opt-in): log de reações removidas
}