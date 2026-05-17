// RPTool/supercommands/logs/events/voiceLogs.ts
// Intent necessário: GUILD_VOICE_STATES (1 << 7)
// ⚠️ NÃO IMPLEMENTADO
import { VoiceState, Client } from 'discord.js';

export async function onVoiceStateUpdate(_old: VoiceState, _new: VoiceState, _client: Client) {
    // TODO: detectar e logar cada transição individualmente:
    //   entrou em canal | saiu de canal | mudou de canal
    //   server mute/deafen | self mute/deafen | stream on/off | câmera on/off
    //   stage: speaker ↔ audience | speaker request
    // Loga: usuário, canal de/para, timestamp
    // ⚠️ Volume moderado-alto; filtrar por mudanças relevantes
}