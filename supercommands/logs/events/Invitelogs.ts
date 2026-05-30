// RPTool/supercommands/logs/events/Invitelogs.ts
// ─── Log: Convites ────────────────────────────────────────────────────────────
// Intent: GUILD_INVITES (1 << 6)
//
// FIX ts(2345 / 2339): invite.guild é tipado como Guild | null no discord.js v14,
// mesmo após o null-check o TypeScript não faz narrowing automaticamente para
// métodos como fetchAuditLogs(). Solução: usar non-null assertion (guild!)
// no ponto onde já confirmamos que não é null — sem (as any).

import { Invite, Guild, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, formatDate } from '../utils/LogMinister';

EventCheckout.onInviteCreate('logs:inviteCreate', async (invite: Invite) => {
    if (!invite.guild) return;
    const guild = invite.guild as Guild; // narrowing: confirmado acima que não é null

    const lm = await LogMinister.for(guild);
    if (!lm || !lm.allows('invites')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.join)
        .setDescription(`🔗 Convite **${invite.code}** criado`)
        .addFields(
            { name: 'Canal',         value: invite.channel ? `<#${invite.channelId}>` : '?', inline: true },
            { name: 'Criado por',    value: invite.inviter ? `<@${invite.inviter.id}>` : 'Desconhecido', inline: true },
            { name: 'Usos máximos', value: invite.maxUses ? String(invite.maxUses) : 'Infinito', inline: true },
            { name: 'Expira em',    value: invite.expiresAt ? formatDate(invite.expiresAt) : 'Nunca', inline: true },
            { name: 'Temporário',   value: invite.temporary ? 'Sim' : 'Não', inline: true },
        )
        .addFields({
            name:  '\u200B',
            value: idBlock({
                Invite: invite.code,
                ...(invite.inviter ? { User: invite.inviter.id } : {}),
            }),
        })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onInviteDelete('logs:inviteDelete', async (invite: Invite) => {
    if (!invite.guild) return;
    const guild = invite.guild as Guild; // narrowing: confirmado acima que não é null

    const lm = await LogMinister.for(guild);
    if (!lm || !lm.allows('invites')) return;

    let executor = '';
    try {
        // FIX: usar guild (já tipado como Guild) em vez de (invite.guild as any)
        const audit = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.InviteDelete });
        const entry = audit.entries.first();
        if (entry && Date.now() - entry.createdTimestamp < 5_000 && entry.executor)
            executor = entry.executor.id;
    } catch { /* sem permissão */ }

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`🔗 Convite **${invite.code}** deletado`)
        .addFields(
            { name: 'Canal', value: invite.channel ? `<#${invite.channelId}>` : '?', inline: true },
            { name: 'Usos',  value: `${invite.uses ?? 0}`, inline: true },
            ...(executor ? [{ name: 'Deletado por', value: `<@${executor}>`, inline: true }] : []),
        )
        .addFields({ name: '\u200B', value: idBlock({ Invite: invite.code }) })
        .setTimestamp();

    await lm.send(embed);
});
