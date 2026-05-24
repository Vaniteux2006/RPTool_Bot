// RPTool/supercommands/logs/events/Moderationlogs.ts
// ─── Log: Moderação ───────────────────────────────────────────────────────────
// Intent: GUILD_MODERATION (1 << 2)
// Referência visual: imagem 9 (ban)
//
// FIX ts(2339): entry.target é uma union enorme no discord.js v14.
// Para MemberKick e MemberUpdate o target é sempre User — fazemos o cast
// explícito para User logo após o guard, eliminando o erro de tipo.

import {
    GuildBan, GuildAuditLogsEntry, Guild,
    AuditLogEvent, EmbedBuilder, User,
} from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, truncate, avatarOf } from '../utils/LogMinister';

// ─── Ban (imagem 9) ───────────────────────────────────────────────────────────
EventCheckout.onGuildBanAdd('logs:banAdd', async (ban: GuildBan) => {
    const lm = await LogMinister.for(ban.guild);
    if (!lm || !lm.allows('moderation')) return;

    const idEntries: Record<string, string> = { User: ban.user.id };
    let reason   = ban.reason ?? 'Nenhum motivo fornecido';

    try {
        const audit = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const entry = audit.entries.first();
        if (entry && entry.target?.id === ban.user.id && Date.now() - entry.createdTimestamp < 5_000) {
            if (entry.reason) reason = entry.reason;
            if (entry.executor) idEntries['Perpetrator'] = entry.executor.id;
        }
    } catch { /* sem permissão */ }

    const embed = new EmbedBuilder()
        .setColor(LogColor.ban)
        .setAuthor({
            name:    ban.user.tag,
            iconURL: avatarOf(ban.user) ?? undefined,
        })
        .setDescription(`**${ban.user.tag}** foi banido`)
        .addFields(
            { name: 'Informações do usuário', value: `${ban.user.tag} (${ban.user.id}) <@${ban.user.id}>` },
            { name: 'Motivo', value: truncate(reason) },
        )
        .addFields({ name: '\u200B', value: idBlock(idEntries) })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Unban ────────────────────────────────────────────────────────────────────
EventCheckout.onGuildBanRemove('logs:banRemove', async (ban: GuildBan) => {
    const lm = await LogMinister.for(ban.guild);
    if (!lm || !lm.allows('moderation')) return;

    const idEntries: Record<string, string> = { User: ban.user.id };

    try {
        const audit = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
        const entry = audit.entries.first();
        if (entry && entry.target?.id === ban.user.id && Date.now() - entry.createdTimestamp < 5_000) {
            if (entry.executor) idEntries['Perpetrator'] = entry.executor.id;
        }
    } catch { /* sem permissão */ }

    const embed = new EmbedBuilder()
        .setColor(LogColor.unban)
        .setAuthor({
            name:    ban.user.tag,
            iconURL: avatarOf(ban.user) ?? undefined,
        })
        .setDescription(`**${ban.user.tag}** foi desbanido`)
        .addFields(
            { name: 'Informações do usuário', value: `${ban.user.tag} (${ban.user.id}) <@${ban.user.id}>` },
        )
        .addFields({ name: '\u200B', value: idBlock(idEntries) })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Audit Log Entry — dispatcher por tipo de ação ────────────────────────────
// FIX ts(2339): em vez de (entry.target as any).tag, fazemos o cast tipado
// para User após confirmar que target existe. Para MemberKick e MemberUpdate
// o target é SEMPRE um User — o cast é seguro.
//
// Padrão usado em todos os handlers abaixo:
//   const target = entry.target as User;
//   → target.tag, target.displayAvatarURL() resolvem sem erro de tipo.

const AUDIT_LOG_HANDLERS: Partial<Record<
    AuditLogEvent,
    (entry: GuildAuditLogsEntry, guild: Guild, lm: LogMinister) => Promise<void>
>> = {

    // ── Kick ──────────────────────────────────────────────────────────────────
    [AuditLogEvent.MemberKick]: async (entry, _guild, lm) => {
        if (!entry.target) return;
        const target = entry.target as User; // target de MemberKick é sempre User

        const embed = new EmbedBuilder()
            .setColor(LogColor.warn)
            .setAuthor({
                name:    target.tag,
                iconURL: target.displayAvatarURL({ size: 64 }),
            })
            .setDescription(`**${target.tag}** foi expulso (kick)`)
            .addFields(
                {
                    name:  'Informações do usuário',
                    value: `${target.tag} (${target.id}) <@${target.id}>`,
                },
                { name: 'Motivo', value: truncate(entry.reason ?? 'Nenhum motivo fornecido') },
            )
            .addFields({
                name:  '\u200B',
                value: idBlock({
                    User:        target.id,
                    Perpetrator: entry.executor?.id ?? '?',
                }),
            })
            .setTimestamp();

        await lm.send(embed);
    },

    // ── Timeout ───────────────────────────────────────────────────────────────
    [AuditLogEvent.MemberUpdate]: async (entry, _guild, lm) => {
        // MemberUpdate cobre muitas coisas — filtrar apenas timeout
        if (!entry.changes?.some(c => c.key === 'communication_disabled_until')) return;
        if (!entry.target) return;
        const target = entry.target as User; // target de MemberUpdate é sempre User

        const change  = entry.changes.find(c => c.key === 'communication_disabled_until')!;
        const newVal  = change.new as string | null;
        const isApply = !!newVal && new Date(newVal) > new Date();

        const embed = new EmbedBuilder()
            .setColor(isApply ? LogColor.warn : LogColor.join)
            .setAuthor({
                name:    target.tag,
                iconURL: target.displayAvatarURL({ size: 64 }),
            })
            .setDescription(
                isApply
                    ? `🔇 **${target.tag}** recebeu timeout até ${new Date(newVal!).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
                    : `🔊 Timeout de **${target.tag}** foi removido`,
            )
            .addFields(
                { name: 'Motivo', value: truncate(entry.reason ?? 'Nenhum motivo fornecido') },
            )
            .addFields({
                name:  '\u200B',
                value: idBlock({
                    User:        target.id,
                    Perpetrator: entry.executor?.id ?? '?',
                }),
            })
            .setTimestamp();

        await lm.send(embed);
    },
};

EventCheckout.onGuildAuditLogEntryCreate('logs:auditLogEntry', async (entry: GuildAuditLogsEntry, guild: Guild) => {
    const lm = await LogMinister.for(guild);
    if (!lm || !lm.allows('moderation')) return;

    const handler = AUDIT_LOG_HANDLERS[entry.action as AuditLogEvent];
    if (handler) await handler(entry, guild, lm).catch(e =>
        console.error(`❌ [logs:auditLogEntry] ${AuditLogEvent[entry.action]}:`, e),
    );
});
