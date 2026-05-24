// RPTool/supercommands/logs/events/VoiceChannelEffectLogs.ts
// ─── Log: Efeitos em Canal de Voz ────────────────────────────────────────────
// Intent: GUILD_VOICE_STATES (1 << 7) — VOICE_CHANNEL_EFFECT_SEND
//
// ⚠️ VOLUME EXTREMAMENTE ALTO — opt-in rigoroso, NÃO é uma categoria do
//    LOG_CATEGORIES padrão. Ativar APENAS via configuração manual direta.
//    Desativado por padrão mesmo que o intent esteja ativo.
//
// Caso de uso restrito: investigação forense de uso de soundboard/emojis
// em chamadas durante um incidente específico. Não deve ficar ligado
// continuamente em produção.
//
// O que é: usuário usa emoji animado, soundboard, ou efeito de voz numa call.
// Estrutura do evento (discord.js expõe como 'any' por ser recente):
//   effect.channelId   — canal de voz
//   effect.userId      — quem usou
//   effect.guildId     — servidor
//   effect.emoji       — GuildEmoji | null (emoji animado)
//   effect.soundId     — string | null (soundboard)
//   effect.soundVolume — number | null (volume do efeito)
//   effect.animationType — number | null

import { EmbedBuilder } from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock } from '../utils/LogMinister';

// NÃO inscrito por padrão — descomente APENAS para investigação pontual
// e comente novamente após uso para evitar flood no canal de logs.
/*
EventCheckout.onVoiceChannelEffectSend('logs:voiceEffect', async (effect: any) => {
    if (!effect.guildId) return;

    // Buscar a guild manualmente — o evento não expõe .guild diretamente
    const guild = effect.channel?.guild ?? null;
    if (!guild) return;

    const lm = await LogMinister.for(guild);
    // Usar uma categoria auxiliar de altíssimo volume — não faz parte das categorias padrão
    // Verificar se foi ativada manualmente:
    if (!lm) return;

    const emojiDisplay = effect.emoji
        ? `<${effect.emoji.animated ? 'a' : ''}:${effect.emoji.name}:${effect.emoji.id}>`
        : null;
    const soundInfo = effect.soundId
        ? `Soundboard ID \`${effect.soundId}\` (volume: ${(effect.soundVolume ?? 1) * 100}%)`
        : null;

    const effectDescription = emojiDisplay ?? soundInfo ?? `Efeito desconhecido`;

    const embed = new EmbedBuilder()
        .setColor(LogColor.voice)
        .setDescription(`🎵 <@${effect.userId}> usou ${effectDescription} em <#${effect.channelId}>`)
        .addFields({
            name:  '\u200B',
            value: idBlock({
                User:    effect.userId,
                Channel: effect.channelId,
                ...(effect.soundId ? { Sound: effect.soundId } : {}),
            }),
        })
        .setTimestamp();

    await lm.send(embed);
});
*/

// Arquivo mantido como documentação — o handler está comentado intencionalmente.
export {};
