// RPTool/supercommands/logs/events/StageInstanceUpdateLogs.ts
// ─── Log: Stage Instance Update ───────────────────────────────────────────────
// Intent: GUILDS (1 << 0) — STAGE_INSTANCE_UPDATE
// Complementa o GuildLogs.ts que já cobre Create e Delete.
// Evento: tópico alterado, privacidade alterada.

import { StageInstance, StageInstancePrivacyLevel, EmbedBuilder } from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, truncate } from '../utils/LogMinister';

const privacyLabel: Record<StageInstancePrivacyLevel, string> = {
    [StageInstancePrivacyLevel.Public]:    '🌐 Público',
    [StageInstancePrivacyLevel.GuildOnly]: '🔒 Apenas membros do servidor',
};

EventCheckout.onStageInstanceUpdate('logs:stageUpdate', async (
    old: StageInstance | null,
    newStage: StageInstance,
) => {
    if (!newStage.guild) return;

    const lm = await LogMinister.for(newStage.guild);
    if (!lm || !lm.allows('channels')) return;

    const changes: { name: string; value: string }[] = [];

    if (old?.topic !== newStage.topic) {
        changes.push(
            { name: 'Tópico novo',    value: truncate(newStage.topic ?? '*(sem tópico)*') },
            { name: 'Tópico antigo',  value: truncate(old?.topic    ?? '*(sem tópico)*') },
        );
    }

    if (old?.privacyLevel !== newStage.privacyLevel) {
        changes.push({
            name:  'Privacidade',
            value: `${privacyLabel[old?.privacyLevel ?? StageInstancePrivacyLevel.GuildOnly]} → ${privacyLabel[newStage.privacyLevel]}`,
        });
    }

    if (!changes.length) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.update)
        .setDescription(`🎙️ Stage em <#${newStage.channelId}> foi atualizada`)
        .addFields(...changes)
        .addFields({
            name:  '\u200B',
            value: idBlock({ Stage: newStage.id, Channel: newStage.channelId }),
        })
        .setTimestamp();

    await lm.send(embed);
});
