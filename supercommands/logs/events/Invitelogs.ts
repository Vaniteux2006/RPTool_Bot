// RPTool/supercommands/logs/events/inviteLogs.ts
// Intent necessário: GUILD_INVITES (1 << 6)
// ⚠️ NÃO IMPLEMENTADO
import { Invite, Client } from 'discord.js';

export async function onInviteCreate(_invite: Invite, _client: Client) {
    // TODO: código, canal, criador, usos máximos, expiração, temporário
}

export async function onInviteDelete(_invite: Invite, _client: Client) {
    // TODO: código deletado; verificar se foi expirado ou manualmente removido
    // Atenção: invite.inviter pode ser null se a invite expirou naturalmente
}