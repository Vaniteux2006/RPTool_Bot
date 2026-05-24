// RPTool/events/memberEvents.ts
// ─── Intent: GUILD_MEMBERS (1 << 1) ⚠️ Privileged ────────────────────────────
// Eventos: GUILD_MEMBER_ADD · GUILD_MEMBER_UPDATE · GUILD_MEMBER_REMOVE
//
// Subscribers ativos (registrados em seus próprios arquivos):
//   commands/autorole.ts   → EventCheckout.onGuildMemberAdd('autorole', ...)
//   commands/welcome.ts    → EventCheckout.onGuildMemberAdd('welcome', ...)
//                          → EventCheckout.onGuildMemberRemove('welcome', ...)
//
// Subscribers de log (stub — aguardando implementação):
//   supercommands/logs/events/Memberlogs.ts
//     → EventCheckout.onGuildMemberAdd('logs:memberAdd', ...)
//     → EventCheckout.onGuildMemberRemove('logs:memberRemove', ...)
//     → EventCheckout.onGuildMemberUpdate('logs:memberUpdate', ...)
//
// Este arquivo é reservado para handlers centrais que NÃO pertencem a nenhum
// comando específico. Por enquanto serve como documentação do intent.

import { EventCheckout } from '../tools/event_checkout';
import { GuildMember, PartialGuildMember } from 'discord.js';

// Slot de handler central — adicione aqui lógica que não pertença a um comando.
// Exemplo futuro: detector de raid (muitos joins em curto tempo).
EventCheckout.onGuildMemberAdd('memberEvents:central', async (_member: GuildMember) => {
    // TODO: detector de raid / joins em burst
    // TODO: cache de membros para correlação com outros eventos
});

EventCheckout.onGuildMemberRemove('memberEvents:central', async (_member: GuildMember | PartialGuildMember) => {
    // TODO: limpeza de dados temporários do membro
});

EventCheckout.onGuildMemberUpdate('memberEvents:central', async (_old: GuildMember | PartialGuildMember, _new: GuildMember) => {
    // TODO: detecção de mudança de nome/apelido fora de logs
});
