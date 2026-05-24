// RPTool/supercommands/logs/events/ChannelPinsLogs.ts
// ─── Log: Mensagens Fixadas ───────────────────────────────────────────────────
// Intent: GUILDS (1 << 0) — CHANNEL_PINS_UPDATE
//
// ⚠️ CHANNEL_PINS_UPDATE não informa QUAL mensagem foi fixada/desafixada,
//    apenas que o estado de pins do canal mudou. Para saber qual, precisamos
//    buscar o audit log (MessagePin / MessageUnpin) — que só existe se a ação
//    foi feita por um moderador. Auto-fix de bots não gera audit log entry.
//    Estratégia: buscar audit log, se não encontrar informar apenas que mudou.

import { AuditLogEvent, EmbedBuilder } from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, truncate } from '../utils/LogMinister';

EventCheckout.onChannelPinsUpdate('logs:channelPinsUpdate', async (channel: any, _time: Date | null) => {
    // Pins de DM não têm guild
    if (!channel.guild) return;

    const lm = await LogMinister.for(channel.guild);
    if (!lm || !lm.allows('channels')) return;

    const idEntries: Record<string, string> = { Channel: channel.id };
    let description = `📌 Uma mensagem foi fixada ou desafixada em <#${channel.id}>`;
    const fields: { name: string; value: string; inline?: boolean }[] = [];

    // Tentar descobrir detalhes via audit log
    try {
        const [pinLogs, unpinLogs] = await Promise.all([
            channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessagePin   }).catch(() => null),
            channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageUnpin }).catch(() => null),
        ]);

        const pinEntry   = pinLogs?.entries.first();
        const unpinEntry = unpinLogs?.entries.first();
        const recentMs   = 5_000;

        // Verificar qual aconteceu mais recentemente
        const isPin   = !!(pinEntry   && Date.now() - pinEntry.createdTimestamp   < recentMs);
        const isUnpin = !!(unpinEntry && Date.now() - unpinEntry.createdTimestamp  < recentMs);
        const entry   = isPin ? pinEntry : isUnpin ? unpinEntry : null;

        if (entry) {
            const action     = isPin ? 'fixou' : 'desafixou';
            const actionIcon = isPin ? '📌' : '📍';
            description = `${actionIcon} <@${entry.executor?.id}> **${action}** uma mensagem em <#${channel.id}>`;

            if (entry.executor) idEntries['Moderador'] = entry.executor.id;
            if (entry.target)   idEntries['Autor da msg'] = (entry.target as any).id ?? '?';

            // Tentar buscar o conteúdo da mensagem que foi fixada/desafixada
            const extra = entry.extra as any;
            if (extra?.messageId) {
                idEntries['Mensagem'] = extra.messageId;
                try {
                    const msg = await channel.messages.fetch(extra.messageId);
                    if (msg?.content) {
                        fields.push({ name: 'Conteúdo', value: truncate(msg.content) });
                    }
                } catch { /* mensagem deletada ou sem permissão */ }
            }
        }
    } catch { /* sem permissão de audit log */ }

    const embed = new EmbedBuilder()
        .setColor(LogColor.update)
        .setDescription(description);

    if (fields.length) embed.addFields(...fields);
    embed.addFields({ name: '\u200B', value: idBlock(idEntries) });
    embed.setTimestamp();

    await lm.send(embed);
});
