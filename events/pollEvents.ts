// RPTool/events/Pollevents.ts
// ─── Intent: GUILD_MESSAGE_POLLS (1 << 24) ───────────────────────────────────
// Eventos: MESSAGE_POLL_VOTE_ADD · MESSAGE_POLL_VOTE_REMOVE
//
// ⚠️ INTENTS REMOVIDOS intencionalmente:
//   DIRECT_MESSAGE_POLLS (1 << 25) — votos em enquetes de DM.
//   Removido para reduzir surface de dados em versão open source.
//   Reativar adicionando o intent no index.ts se necessário.
//
// Subscribers de log (opt-in — volume alto):
//   supercommands/logs/events/Messagelogs.ts → onPollVoteAdd/Remove

import { EventCheckout } from '../tools/event_checkout';
import { PollAnswer } from 'discord.js';

// Não inscritos por padrão — ativar quando houver caso de uso ativo.
// Possível uso futuro: enquetes de RP com resultado aplicado automaticamente.
//
// EventCheckout.onMessagePollVoteAdd('pollEvents:central', async (_answer: PollAnswer, _userId: string) => {});
// EventCheckout.onMessagePollVoteRemove('pollEvents:central', async (_answer: PollAnswer, _userId: string) => {});

// Mantém o arquivo como placeholder e documentação do intent.
export {};
