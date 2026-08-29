// RPTool/tools/utils/discord/permissions.ts
// ─── Checagem de permissão em comandos de texto ───────────────────────────────
// SEMPRE via message.member: ele vem no payload do evento, não do cache.
// Ler de guild.members.cache é um bug intermitente — o sweeper do index.ts varre
// guildMembers a cada 1h e o `.get()` passa a devolver undefined, negando
// permissão a admins aleatoriamente ("antes funcionava, agora não").
import { Message, PermissionsBitField } from 'discord.js';

export function hasPerm(message: Message, flag: bigint): boolean {
    return !!message.member?.permissions.has(flag);
}

/** Staff do servidor (Gerenciar Servidor). */
export const isStaff = (message: Message): boolean =>
    hasPerm(message, PermissionsBitField.Flags.ManageGuild);

/** Administrador pleno. */
export const isAdmin = (message: Message): boolean =>
    hasPerm(message, PermissionsBitField.Flags.Administrator);

/**
 * Checa a permissão e, se faltar, já responde a mensagem de erro padrão.
 * Retorna true se o autor PODE prosseguir.
 *   if (!await requirePerm(message, Flags.ManageChannels, 'criar relógios')) return;
 */
export async function requirePerm(message: Message, flag: bigint, oQue: string): Promise<boolean> {
    if (hasPerm(message, flag)) return true;
    const nome = new PermissionsBitField(flag).toArray()[0] ?? 'necessária';
    await message.reply(`❌ Você precisa da permissão **${nome}** para ${oQue}.`);
    return false;
}
