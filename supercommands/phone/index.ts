// RPTool/supercommands/phone/index.ts
// Comando prefix-only (rp!phone) — sem registro de slash (ver DOCUMENTACAO.md).
import { Message } from 'discord.js';
import { phoneSystem } from './system';
import { EventCheckout } from '../../tools/eventCheckout';

// Importando os handlers
import handleRegister from './handlers/register';
import handleOff from './handlers/off';
import handleCall from './handlers/call';
import handleAccept from './handlers/accept';
import handleDecline from './handlers/decline';
import handleEnd from './handlers/end';

export default {
    name: 'phone',
    description: 'Sistema de Telefone Inter-Servidores',

    async execute(message: Message | any, args: string[]) {
        await phoneSystem.init();

        const action = args[0] ? args[0].toLowerCase() : null;

        if (!action) {
            return message.reply("📱 **Telefone:** Use `register, call, accept, decline, end`.");
        }

        try {
            switch (action) {
                case 'register': await handleRegister(message, args); break;
                case 'off': await handleOff(message); break;
                case 'call': await handleCall(message, args); break;
                case 'accept': await handleAccept(message); break;
                case 'decline': await handleDecline(message); break;
                case 'end': await handleEnd(message); break;
                default: message.reply("📱 **Telefone:** Use `register, call, accept, decline, end`."); break;
            }
        } catch (e) {
            console.error(e);
            message.reply("❌ HTTP 418: I'm a teapot");
        }
    },

    async processMessage(message: Message) {
        return await phoneSystem.processPhoneMessage(message);
    }
};

// ─── Auto-inscrição no EventCheckout ─────────────────────────────────────────
// Relê das mensagens de uma chamada ativa: enquanto dois servidores estão
// conectados, cada mensagem normal (sem prefixo) é repassada ao parceiro.
// processPhoneMessage já filtra bots/prefixos/DMs e devolve boolean.
EventCheckout.onMessageCreate('phone:relay', (msg: Message) => phoneSystem.processPhoneMessage(msg));