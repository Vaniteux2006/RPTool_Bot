// RPTool/events/messageEvents.ts
// ─── Intent: GUILD_MESSAGES (1 << 9) ─────────────────────────────────────────
// Eventos: MESSAGE_CREATE · MESSAGE_UPDATE · MESSAGE_DELETE · MESSAGE_DELETE_BULK
// Requer também: MESSAGE_CONTENT (1 << 15) ⚠️ privileged para ler o conteúdo
//
// Subscribers ativos:
//   index.ts → client.on('messageCreate', ...) — roteamento de comandos rp!...
//              (handler separado do EventCheckout, convive sem conflito)
//   supercommands/oc/ → EventCheckout.onMessageCreate('oc:autoResponder', ...)
//
// Subscribers de log (stub):
//   supercommands/logs/events/Messagelogs.ts
//     → EventCheckout.onMessageUpdate('logs:messageUpdate', ...)
//     → EventCheckout.onMessageDelete('logs:messageDelete', ...)
//     → EventCheckout.onMessageBulkDelete('logs:messageBulkDelete', ...)
//
// ⚠️ NOTA: MessageCreate tem ALTO VOLUME. Qualquer subscriber deve ter guard
//    no início (ex: if (msg.author.bot) return) para não processar o desnecessário.

import { EventCheckout } from '../tools/event_checkout';
import { Message, PartialMessage, Collection, Snowflake } from 'discord.js';

// Slot central para lógica que não pertença a um comando específico.
EventCheckout.onMessageCreate('messageEvents:central', async (_msg: Message) => {
    // Slot reservado. O roteamento de comandos rp! fica no index.ts.
    // Possível uso futuro: anti-spam por conteúdo, filtro de palavras global.
});

EventCheckout.onMessageUpdate('messageEvents:central', async (_old: Message | PartialMessage, _new: Message | PartialMessage) => {
    // Slot reservado.
});

EventCheckout.onMessageDelete('messageEvents:central', async (_msg: Message | PartialMessage) => {
    // Slot reservado.
});

EventCheckout.onMessageBulkDelete('messageEvents:central', async (_msgs: Collection<Snowflake, Message | PartialMessage>) => {
    // Slot reservado.
});
