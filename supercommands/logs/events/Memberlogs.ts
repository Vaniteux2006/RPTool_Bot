// RPTool/supercommands/logs/events/Memberlogs.ts
// ─── Log de Membros ───────────────────────────────────────────────────────────
// Intent: GUILD_MEMBERS (1 << 1) ⚠️ Privileged
// Referências visuais: imagens 2 (leave), 3 (join), 5 (username), 6 (role update)

import {
    GuildMember, PartialGuildMember, EmbedBuilder, AuditLogEvent,
} from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, formatDate, daysAgo, avatarOf, truncate } from '../utils/LogMinister';

// ─── Invite Tracker ───────────────────────────────────────────────────────────
// Cache local de convites por servidor para identificar qual foi usado no join.
// Atualizado em: GuildCreate (bot entra), InviteCreate, InviteDelete.
const inviteCache = new Map<string, Map<string, number>>(); // guildId → code → uses

async function refreshInvites(member: GuildMember): Promise<void> {
    try {
        const invites = await member.guild.invites.fetch();
        inviteCache.set(
            member.guild.id,
            new Map(invites.map(inv => [inv.code, inv.uses ?? 0])),
        );
    } catch { /* sem permissão de gerenciar convites */ }
}

async function detectUsedInvite(member: GuildMember): Promise<string> {
    try {
        const before = inviteCache.get(member.guild.id);
        const after  = await member.guild.invites.fetch();

        for (const [code, inv] of after) {
            const prevUses = before?.get(code) ?? 0;
            if ((inv.uses ?? 0) > prevUses) {
                inviteCache.set(member.guild.id, new Map(after.map(i => [i.code, i.uses ?? 0])));
                return `${code} com ${inv.uses} usos`;
            }
        }
        inviteCache.set(member.guild.id, new Map(after.map(i => [i.code, i.uses ?? 0])));
    } catch { /* sem permissão */ }
    return 'Desconhecido';
}

// ─── Member Join (imagem 3) ───────────────────────────────────────────────────
EventCheckout.onGuildMemberAdd('logs:memberAdd', async (member: GuildMember) => {
    const lm = await LogMinister.for(member.guild);
    if (!lm || !lm.allows('members')) return;

    const inviteUsed    = await detectUsedInvite(member);
    const accountAge    = daysAgo(member.user.createdAt);
    const isNewAccount  = accountAge < 7;
    const hasNoAvatar   = !member.user.avatar;

    const warnings: string[] = [];
    if (isNewAccount) warnings.push(`⚠️ Conta nova (${accountAge} dias)`);
    if (hasNoAvatar)  warnings.push('⚠️ Sem avatar — possível conta descartável');

    const embed = new EmbedBuilder()
        .setColor(LogColor.join)
        .setAuthor({
            name:    member.user.tag,
            iconURL: avatarOf(member.user) ?? undefined,
        })
        .setDescription(`<@${member.id}> entrou no servidor`)
        .addFields(
            { name: 'Nome',         value: `${member.user.tag} (${member.id}) <@!${member.id}>` },
            { name: 'Entrou em',    value: formatDate(member.joinedAt) },
            {
                name:   'Idade da conta',
                value:  `${accountAge} dias`,
                inline: true,
            },
            {
                name:   'Total de membros',
                value:  String(member.guild.memberCount),
                inline: true,
            },
            {
                name:   'Convite usado',
                value:  inviteUsed,
                inline: true,
            },
        );

    if (warnings.length) {
        embed.addFields({ name: '🚨 Alertas', value: warnings.join('\n') });
    }

    embed.addFields({ name: '\u200B', value: idBlock({ Member: member.id, Guild: member.guild.id }) });
    embed.setTimestamp();

    await lm.send(embed);
});

// ─── Member Leave (imagem 2) ──────────────────────────────────────────────────
EventCheckout.onGuildMemberRemove('logs:memberRemove', async (member: GuildMember | PartialGuildMember) => {
    const lm = await LogMinister.for(member.guild);
    if (!lm || !lm.allows('members')) return;

    // Verificar se foi kick ou ban via audit log
    const [kickLogs, banLogs] = await Promise.all([
        member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick   }).catch(() => null),
        member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null),
    ]);
    const kickEntry = kickLogs?.entries.first();
    const banEntry  = banLogs?.entries.first();
    const recentMs  = 5_000;

    const isBan  = !!(banEntry  && banEntry.target?.id  === member.id && Date.now() - banEntry.createdTimestamp  < recentMs);
    const isKick = !isBan && !!(kickEntry && kickEntry.target?.id === member.id && Date.now() - kickEntry.createdTimestamp < recentMs);

    // Se for ban ou kick, o handler específico já vai logar — evitar duplicata
    if (isBan || isKick) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setAuthor({
            name:    member.user?.tag ?? `ID ${member.id}`,
            iconURL: avatarOf(member.user) ?? undefined,
        })
        .setDescription(`${member.user?.tag ?? `<@${member.id}>`} saiu do servidor`)
        .addFields(
            {
                name:  'Informações do usuário',
                value: `${member.user?.tag ?? '?'} (${member.id}) <@${member.id}>`,
            },
            {
                name:  'Conta criada em',
                value: formatDate(member.user?.createdAt ?? null),
            },
        );

    if (member.joinedAt) {
        const daysInServer = daysAgo(member.joinedAt);
        embed.addFields({ name: 'Tempo no servidor', value: `${daysInServer} dias` });
    }

    embed.addFields({ name: '\u200B', value: idBlock({ User: member.id }) });
    embed.setTimestamp();

    await lm.send(embed);
});

// ─── Member Update (imagem 5 = username, imagem 6 = role) ────────────────────
EventCheckout.onGuildMemberUpdate('logs:memberUpdate', async (
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
) => {
    const lm = await LogMinister.for(newMember.guild);
    if (!lm || !lm.allows('members')) return;

    const changes: { name: string; value: string; inline?: boolean }[] = [];
    const idEntries: Record<string, string> = { User: newMember.id };

    // Nickname alterado
    if (oldMember.nickname !== newMember.nickname) {
        changes.push(
            { name: 'Apelido novo',    value: newMember.nickname  ?? `*(removido)*` },
            { name: 'Apelido antigo',  value: oldMember.nickname  ?? `*(sem apelido)*` },
        );
    }

    // Username / display name alterado (imagem 5)
    if (oldMember.user?.tag !== newMember.user.tag) {
        changes.push(
            { name: 'Nome novo',    value: newMember.user.tag },
            { name: 'Nome antigo',  value: oldMember.user?.tag ?? '?' },
        );
    }

    // Cargos adicionados / removidos (imagem 6)
    const oldRoles = oldMember.roles instanceof Object && 'cache' in oldMember.roles
        ? (oldMember as GuildMember).roles.cache
        : new Map();
    const newRoles = newMember.roles.cache;

    const added   = [...newRoles.values()].filter(r => !oldRoles.has(r.id) && r.id !== newMember.guild.id);
    const removed = [...oldRoles.values()].filter(r => !newRoles.has(r.id) && r.id !== newMember.guild.id);

    if (added.length || removed.length) {
        const lines: string[] = [
            ...added.map(r   => `➕ ${r}`),
            ...removed.map(r => `➖ ${r}`),
        ];
        changes.push({ name: 'Alterações', value: truncate(lines.join('\n')) });

        // Buscar quem fez a alteração no audit log (imagem 6: "Perpetrator")
        try {
            const audit = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
            const entry = audit.entries.first();
            if (entry && entry.target?.id === newMember.id && Date.now() - entry.createdTimestamp < 5_000) {
                idEntries['Perpetrator'] = entry.executor?.id ?? 'Desconhecido';
            }
        } catch { /* sem permissão */ }
    }

    // Timeout aplicado / removido
    const oldTimeout = (oldMember as GuildMember).communicationDisabledUntil;
    const newTimeout = newMember.communicationDisabledUntil;
    if (oldTimeout?.getTime() !== newTimeout?.getTime()) {
        if (newTimeout && newTimeout > new Date()) {
            changes.push({ name: '🔇 Timeout aplicado até', value: formatDate(newTimeout) });
        } else if (oldTimeout) {
            changes.push({ name: '🔊 Timeout removido', value: formatDate(oldTimeout) });
        }
    }

    // Avatar de servidor alterado
    if ((oldMember as GuildMember).avatar !== newMember.avatar && newMember.avatar) {
        changes.push({ name: 'Avatar de servidor alterado', value: `[Ver novo avatar](${newMember.displayAvatarURL({ size: 256 })})` });
    }

    if (!changes.length) return; // nenhuma mudança relevante

    const embed = new EmbedBuilder()
        .setColor(LogColor.update)
        .setAuthor({
            name:    newMember.user.tag,
            iconURL: avatarOf(newMember.user) ?? undefined,
        })
        .setDescription(`<@${newMember.id}> foi atualizado`)
        .addFields(...changes);

    embed.addFields({ name: '\u200B', value: idBlock(idEntries) });
    embed.setTimestamp();

    await lm.send(embed);
});
