import { Message } from 'discord.js';
import { tokenize } from '../../tools/utils/economy';

import handleView from './handlers/view';
import handlePay from './handlers/pay';
import handleTop from './handlers/top';
import handleAdmin from './handlers/admin';
import handleEconomy from './handlers/economy';
import helpCommand from '../help/index';

// ─── SuperComando rp!wallet ───────────────────────────────────────────────────
// Carteira POR PERSONAGEM (OC), isolada por servidor. Inspirado no UnbelievaBoat,
// mas o dinheiro pertence ao tupper, não à conta Discord.
export default {
    name: 'wallet',
    description: 'Carteira dos seus OCs (dinheiro por personagem)',
    aliases: ['bank', 'saldo', 'money', 'carteira', 'w'],

    execute: async (message: Message, args: string[]) => {
        const userId = message.author.id;

        if (!message.guild) {
            return message.reply('💸 A economia só funciona dentro de um servidor.');
        }

        // Re-tokeniza o conteúdo bruto pra respeitar nomes entre aspas
        // (o `args` do roteador já quebrou "Nome com espaço" em pedaços).
        const tokens = tokenize(message.content);
        const action = (tokens[1] || '').toLowerCase();
        const rest = tokens.slice(2);

        try {
            switch (action) {
                case 'pay': case 'pagar': case 'transfer': case 'transferir':
                    return handlePay(message, rest, userId);

                case 'top': case 'ranking': case 'rank': case 'ricos':
                    return handleTop(message, userId);

                case 'economia': case 'economy': case 'eco':
                    return handleEconomy(message, rest, userId);

                case 'add': case 'adicionar':
                case 'remove': case 'remover': case 'tirar':
                case 'set': case 'definir':
                case 'setcurrency': case 'moeda':
                case 'reset': case 'zerar':
                    return handleAdmin(message, action, rest, userId);

                case 'help': case 'ajuda': case 'comandos':
                    return helpCommand.execute(message, ['wallet', ...args.slice(1)]);

                default:
                    // Sem ação conhecida → visualizar carteira.
                    // tokens.slice(1) preserva o possível "Nome" (e/ou @menção).
                    return handleView(message, tokens.slice(1), userId);
            }
        } catch (error) {
            console.error('[WALLET]', error);
            return message.reply('❌ Erro interno na carteira.');
        }
    },
};
