// RPTool/events/voiceEvents.ts
// ─── Intent: GUILD_VOICE_STATES (1 << 7) ─────────────────────────────────────
// Cobre: VOICE_STATE_UPDATE · VOICE_CHANNEL_EFFECT_SEND
import { Events, VoiceState, Client } from 'discord.js';

export default [

    // ── VOICE_STATE_UPDATE ────────────────────────────────────────────────────
    { name: Events.VoiceStateUpdate, once: false,
      execute: async (_old: VoiceState, _new: VoiceState, _client: Client) => {
        // TODO: supercommands/logs/events/voiceLogs.ts → onVoiceStateUpdate
        // Casos: entrou em canal, saiu, mudou de canal, mutou, ensurdeceu,
        //        stream iniciada, câmera ligada, stage speaker/audience
      }},

    // ── VOICE_CHANNEL_EFFECT_SEND ─────────────────────────────────────────────
    // Efeitos de voz (soundboard, emoji reactions em calls) — muito ruidoso
    // Não logar por padrão; ativar apenas se explicitamente configurado
    { name: 'voiceChannelEffectSend' as any, once: false,
      execute: async (_effect: any, _client: Client) => {
        // TODO (opt-in): supercommands/logs/events/voiceLogs.ts → onVoiceEffect
        // ⚠️ Alto volume de eventos — apenas para servidores com necessidade específica
      }},
];