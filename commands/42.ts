// RPTool/commands/42.ts
import { Message } from 'discord.js';
import { EventCheckout } from '../tools/event_checkout';

const cmd42 = {
    name: '42',
    description: 'Responde à Pergunta Fundamental',

    async processMessage(message: Message): Promise<boolean> {
        if (message.author.bot) return false;

        const trigger = 'a resposta para a pergunta fundamental sobre a vida, o universo e tudo mais';
        if (message.content.toLowerCase().includes(trigger)) {
            await message.reply('42');
            return true;
        }
        return false;
    },
};

// ─── Auto-inscrição no EventCheckout ─────────────────────────────────────────
// Declara o interesse — o EventCheckout cuida do resto.
// Se apagar este arquivo, não dá problema no restante do programa.
EventCheckout.onMessageCreate('42', (msg: Message) => cmd42.processMessage(msg));

export default cmd42;
