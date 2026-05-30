// RPTool/supercommands/logs/events/scheduledEventLogs.ts
// ─── Log: Eventos Agendados ───────────────────────────────────────────────────
// Intent: GUILD_SCHEDULED_EVENTS (1 << 16)

import {
    GuildScheduledEvent, PartialGuildScheduledEvent,
    GuildScheduledEventStatus, GuildMember, User, EmbedBuilder,
} from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, formatDate, truncate } from '../utils/LogMinister';

const statusLabel: Record<GuildScheduledEventStatus, string> = {
    [GuildScheduledEventStatus.Scheduled]: '📅 Agendado',
    [GuildScheduledEventStatus.Active]:    '🔴 Ao vivo',
    [GuildScheduledEventStatus.Completed]: '✅ Concluído',
    [GuildScheduledEventStatus.Canceled]:  '❌ Cancelado',
};

EventCheckout.onGuildScheduledEventCreate('logs:scheduledEventCreate', async (event: GuildScheduledEvent) => {
    const lm = await LogMinister.for(event.guild!);
    if (!lm || !lm.allows('scheduled')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.join)
        .setDescription(`📅 Evento **${event.name}** agendado`)
        .addFields(
            { name: 'Início',     value: formatDate(event.scheduledStartAt), inline: true },
            { name: 'Término',    value: event.scheduledEndAt ? formatDate(event.scheduledEndAt) : 'Não definido', inline: true },
            { name: 'Local',      value: event.entityMetadata?.location ?? (event.channel ? `<#${event.channelId}>` : '?') },
            ...(event.description ? [{ name: 'Descrição', value: truncate(event.description) }] : []),
            ...(event.creator ? [{ name: 'Criado por', value: `<@${event.creator.id}>` }] : []),
        )
        .addFields({ name: '\u200B', value: idBlock({ Event: event.id }) })
        .setTimestamp();

    if (event.coverImageURL()) embed.setThumbnail(event.coverImageURL()!);
    await lm.send(embed);
});

EventCheckout.onGuildScheduledEventUpdate('logs:scheduledEventUpdate', async (
    old: GuildScheduledEvent | PartialGuildScheduledEvent | null,
    newEvent: GuildScheduledEvent,
) => {
    const lm = await LogMinister.for(newEvent.guild!);
    if (!lm || !lm.allows('scheduled')) return;

    // Status mudou (iniciou, cancelou, concluiu)
    if (old?.status !== newEvent.status) {
        const label = statusLabel[newEvent.status] ?? `Status ${newEvent.status}`;
        const color = newEvent.status === GuildScheduledEventStatus.Active    ? LogColor.join
            : newEvent.status === GuildScheduledEventStatus.Canceled ? LogColor.leave
            : LogColor.update;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(`📅 Evento **${newEvent.name}** — ${label}`)
            .addFields({ name: '\u200B', value: idBlock({ Event: newEvent.id }) })
            .setTimestamp();

        return lm.send(embed);
    }

    // Outras mudanças (nome, horário, etc.)
    const changes: { name: string; value: string }[] = [];
    if (old?.name !== newEvent.name)
        changes.push({ name: 'Nome', value: `\`${old?.name ?? '?'}\` → \`${newEvent.name}\`` });
    if (old?.scheduledStartAt?.getTime() !== newEvent.scheduledStartAt?.getTime())
        changes.push({ name: 'Início alterado', value: formatDate(newEvent.scheduledStartAt) });

    if (!changes.length) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.update)
        .setDescription(`📅 Evento **${newEvent.name}** atualizado`)
        .addFields(...changes)
        .addFields({ name: '\u200B', value: idBlock({ Event: newEvent.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onGuildScheduledEventDelete('logs:scheduledEventDelete', async (
    event: GuildScheduledEvent | PartialGuildScheduledEvent,
) => {
    if (!event.guild) return;
    const lm = await LogMinister.for(event.guild);
    if (!lm || !lm.allows('scheduled')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`📅 Evento **${event.name ?? 'Desconhecido'}** deletado`)
        .addFields({ name: '\u200B', value: idBlock({ Event: event.id }) })
        .setTimestamp();

    await lm.send(embed);
});

// Opt-in — comentado para não gerar spam em eventos grandes
// EventCheckout.onGuildScheduledEventUserAdd('logs:scheduledEventUserAdd', async (event, user) => { ... });
// EventCheckout.onGuildScheduledEventUserRemove('logs:scheduledEventUserRemove', async (event, user) => { ... });
