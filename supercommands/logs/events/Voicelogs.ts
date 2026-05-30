// RPTool/supercommands/logs/events/Voicelogs.ts
// ─── Log: Voz ─────────────────────────────────────────────────────────────────
// Intent: GUILD_VOICE_STATES (1 << 7)
// Referência visual: imagem 8 (voice join)

import { VoiceState, EmbedBuilder } from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, avatarOf } from '../utils/LogMinister';

EventCheckout.onVoiceStateUpdate('logs:voiceState', async (oldState: VoiceState, newState: VoiceState) => {
    const lm = await LogMinister.for(newState.guild);
    if (!lm || !lm.allows('voice')) return;

    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    const oldCh = oldState.channel;
    const newCh = newState.channel;

    let embed: EmbedBuilder | null = null;

    // ── Entrou em canal (imagem 8) ────────────────────────────────────────────
    if (!oldCh && newCh) {
        embed = new EmbedBuilder()
            .setColor(LogColor.join)
            .setAuthor({
                name:    member.user.tag,
                iconURL: avatarOf(member.user) ?? undefined,
            })
            .setDescription(`**${member.user.tag}** entrou no canal de voz: **${newCh.name}**`)
            .addFields({ name: 'Canal', value: `🔊 ${newCh} (\`${newCh.name}\`)` })
            .addFields({
                name:  '\u200B',
                value: idBlock({ User: member.id, Channel: newCh.id }),
            });
    }

    // ── Saiu de canal ─────────────────────────────────────────────────────────
    else if (oldCh && !newCh) {
        embed = new EmbedBuilder()
            .setColor(LogColor.leave)
            .setAuthor({
                name:    member.user.tag,
                iconURL: avatarOf(member.user) ?? undefined,
            })
            .setDescription(`**${member.user.tag}** saiu do canal de voz: **${oldCh.name}**`)
            .addFields({ name: 'Canal', value: `🔊 ${oldCh} (\`${oldCh.name}\`)` })
            .addFields({
                name:  '\u200B',
                value: idBlock({ User: member.id, Channel: oldCh.id }),
            });
    }

    // ── Mudou de canal ────────────────────────────────────────────────────────
    else if (oldCh && newCh && oldCh.id !== newCh.id) {
        embed = new EmbedBuilder()
            .setColor(LogColor.update)
            .setAuthor({
                name:    member.user.tag,
                iconURL: avatarOf(member.user) ?? undefined,
            })
            .setDescription(`**${member.user.tag}** mudou de canal de voz`)
            .addFields(
                { name: 'De',   value: `🔊 ${oldCh} (\`${oldCh.name}\`)`, inline: true },
                { name: 'Para', value: `🔊 ${newCh} (\`${newCh.name}\`)`, inline: true },
            )
            .addFields({
                name:  '\u200B',
                value: idBlock({ User: member.id, 'Canal anterior': oldCh.id, 'Canal novo': newCh.id }),
            });
    }

    // ── Mudanças de estado (mute/deaf/stream/camera) — sem logar por padrão ──
    // Descomentar se quiser registrar server mute/deaf de moderadores:
    // else if (oldCh && newCh && oldCh.id === newCh.id) {
    //     if (oldState.serverMute !== newState.serverMute) { ... }
    //     if (oldState.serverDeaf !== newState.serverDeaf) { ... }
    // }

    if (!embed) return;
    embed.setTimestamp();
    await lm.send(embed);
});
