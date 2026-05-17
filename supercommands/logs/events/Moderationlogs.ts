// RPTool/supercommands/logs/events/moderationLogs.ts
// ─── Log: Moderação ───────────────────────────────────────────────────────────
// Intents necessários: GUILD_MODERATION (1 << 2)
// ⚠️ NÃO IMPLEMENTADO — aguardando otimização de rate limit e cache
import { GuildBan, GuildAuditLogsEntry, Guild, Client } from 'discord.js';

export async function onBanAdd(_ban: GuildBan, _client: Client) {
    // TODO: embed com usuário banido, motivo, moderador (audit log)
}

export async function onBanRemove(_ban: GuildBan, _client: Client) {
    // TODO: embed com usuário desbanido, quem desbaniu
}

export async function onAuditLogEntry(_entry: GuildAuditLogsEntry, _guild: Guild, _client: Client) {
    // TODO: ponto central de auditoria — filtrar por actionType relevante
    // Prioridade de implementação:
    //   MemberKick, MemberBanAdd/Remove, MemberRoleUpdate
    //   ChannelCreate/Update/Delete, RoleCreate/Update/Delete
    //   MessageDelete, MessageBulkDelete
    //   MemberUpdate (nickname, timeout)
    //   WebhookCreate/Update/Delete
    //   IntegrationCreate/Delete (bot adicionado/removido)
    //
    // ⚠️ NÃO processar todos os tipos de uma vez — filtrar e logar incrementalmente
    //    Implementar com map de handlers: { [AuditLogEvent.X]: handlerFn }
}