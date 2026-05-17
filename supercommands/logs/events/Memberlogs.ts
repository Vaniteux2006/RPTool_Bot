// RPTool/supercommands/logs/events/memberLogs.ts
// ─── Log: Membros ─────────────────────────────────────────────────────────────
// Intents necessários: GUILD_MEMBERS (1 << 1) — Privileged
// ⚠️ NÃO IMPLEMENTADO — aguardando otimização de rate limit e cache
import { GuildMember, PartialGuildMember, Client } from 'discord.js';

export async function onMemberAdd(_member: GuildMember, _client: Client) {
    // TODO: embed com tag, ID, data de criação da conta, avatar
    // Sinalizar: conta nova (< 7 dias), sem avatar (possível bot/raid)
}

export async function onMemberRemove(_member: GuildMember | PartialGuildMember, _client: Client) {
    // TODO: embed com tag, data de entrada, cargos que tinha
    // Distinguir: saiu sozinho vs. kick vs. ban (verificar audit log)
}

export async function onMemberUpdate(_old: GuildMember | PartialGuildMember, _new: GuildMember, _client: Client) {
    // TODO: diff — nickname alterado, cargos adicionados/removidos,
    //       timeout aplicado/removido, avatar de servidor alterado
    // ⚠️ Volume moderado — cachear estado anterior para evitar falsos positivos
}