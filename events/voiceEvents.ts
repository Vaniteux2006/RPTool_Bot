// RPTool/events/voiceEvents.ts
// ─── Intent: GUILD_VOICE_STATES (1 << 7) ─────────────────────────────────────
// Eventos: VOICE_STATE_UPDATE · VOICE_CHANNEL_EFFECT_SEND
//
// Subscribers de log: supercommands/logs/events/Voicelogs.ts
//
// ⚠️ VOICE_CHANNEL_EFFECT_SEND (soundboard/emoji em calls): muito ruidoso.
//    Não logar por padrão. Subscriber onVoiceChannelEffectSend só ativar se
//    explicitamente configurado pelo ADM do servidor.

import { EventCheckout } from '../tools/event_checkout';
import { VoiceState } from 'discord.js';

EventCheckout.onVoiceStateUpdate('voiceEvents:central', async (_old: VoiceState, _new: VoiceState) => {
    // Possível uso ativo: mover usuários, aplicar lógica de canal temporário.
});

// NÃO inscrito por padrão — ativar apenas sob demanda:
// EventCheckout.onVoiceChannelEffectSend('voiceEvents:effects', async (_effect) => {});
