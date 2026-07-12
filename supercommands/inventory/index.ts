import { Message } from 'discord.js';
import { tokenize } from '../../tools/utils/economy';

import handleView from './handlers/view';
import handleGive from './handlers/give';
import handleUse from './handlers/use';
import handleShop from './handlers/shop';
import handleBuy from './handlers/buy';
import handleSell from './handlers/sell';
import handleAdd from './handlers/add';
import handleDrop from './handlers/drop';
import handleAdmin from './handlers/admin';
import handleLevar from './handlers/levar';
import handleOnde from './handlers/onde';
import helpCommand from '../help/index';

// ─── SuperComando rp!inventory ────────────────────────────────────────────────
// Mochila POR PERSONAGEM (OC), isolada por servidor. Loja definida pela staff.
// `levar` na lista de aliases = atalho top-level: rp!levar roteia pra cá e o
// shim abaixo despacha direto pro handler (sem passar pelo switch de ações).
export default {
    name: 'inventory',
    description: 'Mochila e loja dos seus OCs (itens por personagem)',
    aliases: ['inv', 'bag', 'mochila', 'itens', 'i', 'levar'],

    execute: async (message: Message, args: string[]) => {
        const userId = message.author.id;

        if (!message.guild) {
            return message.reply('🎒 O inventário só funciona dentro de um servidor.');
        }

        const tokens = tokenize(message.content);
        const action = (tokens[1] || '').toLowerCase();
        const rest = tokens.slice(2);

        try {
            // Shim do atalho top-level: em `rp!levar "item" "OC"` o tokens[1] é
            // argumento, não ação — despacha direto pro handler.
            const invoked = (tokens[0] || '').toLowerCase().split('!').pop();
            if (invoked === 'levar') {
                return handleLevar(message, tokens.slice(1), userId);
            }

            switch (action) {
                case 'give': case 'dar': case 'trade':
                    return handleGive(message, rest, userId);

                case 'use': case 'usar':
                    return handleUse(message, rest, userId);

                case 'shop': case 'loja': case 'store':
                    return handleShop(message, userId);

                case 'buy': case 'comprar':
                    return handleBuy(message, rest, userId);

                case 'sell': case 'vender':
                    return handleSell(message, rest, userId);

                case 'add': case 'craft': case 'novo': case 'anotar': case 'criar':
                    return handleAdd(message, rest, userId);

                case 'drop': case 'descartar': case 'jogarfora': case 'remove': case 'remover':
                    return handleDrop(message, rest, userId);

                case 'levar': case 'transferir': case 'transfer': case 'mudar': case 'viajar':
                    return handleLevar(message, rest, userId);

                case 'onde': case 'where': case 'servidores': case 'servers':
                    return handleOnde(message, rest, userId);

                case 'additem': case 'edititem': case 'removeitem':
                case 'giveitem': case 'takeitem':
                    return handleAdmin(message, action, rest, userId);

                case 'help': case 'ajuda': case 'comandos':
                    return helpCommand.execute(message, ['inventory', ...args.slice(1)]);

                default:
                    // Sem ação conhecida → ver a mochila (tokens.slice(1) inclui o "Nome").
                    return handleView(message, tokens.slice(1), userId);
            }
        } catch (error) {
            console.error('[INVENTORY]', error);
            return message.reply('❌ Erro interno no inventário.');
        }
    },
};
