import { Message, EmbedBuilder } from 'discord.js';
import { ItemModel } from '../../../tools/models/EconomySchema';
import {
    resolveOwnedOc, getOrCreateWallet, findHeldItem, removeItemFromWallet, stripMentionTokens,
    formatQty,
} from '../../../tools/utils/economy';

// rp!inventory drop ["MeuOC"] "item" [qtd]  → descarta um item da mochila.
// Serve pra qualquer item (pessoal ou de loja) — itens pessoais não têm venda.
export default async function handleDrop(message: Message, rest: string[], userId: string) {
    const tokens = stripMentionTokens(rest);

    let qty = 1;
    if (tokens.length && /^\d+$/.test(tokens[tokens.length - 1])) {
        qty = parseInt(tokens.pop() as string, 10);
    }

    const name = tokens.length >= 2 ? tokens[0] : '';
    const itemName = tokens.length >= 2 ? tokens[1] : tokens[0];

    if (!itemName || qty <= 0) {
        return message.reply('⚠️ Uso: `rp!inventory drop "SeuOC" "item" [qtd]`.');
    }

    const guildId = message.guild!.id;

    const oc = await resolveOwnedOc(name, userId);
    if (!oc) {
        return message.reply(name
            ? `🚫 Você não controla nenhum OC chamado **${name}**.`
            : '⚠️ Diga qual OC: `rp!inventory drop "SeuOC" "item"` (ou tenha só um OC).');
    }

    const wallet = await getOrCreateWallet(guildId, oc);
    const held = findHeldItem(wallet, itemName);
    if (!held) {
        return message.reply(`🎒 **${oc.name}** não tem **${itemName}** na mochila.`);
    }

    let displayName = held.name || held.key;
    let displayEmoji = held.emoji || '📦';
    if (!held.custom) {
        const cat = await ItemModel.findOne({ guildId, key: held.key });
        if (cat) { displayName = cat.name; displayEmoji = cat.emoji; }
    }

    const removed = await removeItemFromWallet(guildId, oc._id, held.key, qty);
    if (!removed) {
        return message.reply(`🎒 **${oc.name}** não tem ${formatQty(qty)}× **${displayName}** pra descartar.`);
    }

    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setDescription(`🗑️ **${oc.name}** descartou **${formatQty(qty)}× ${displayEmoji} ${displayName}**.`);

    return message.reply({ embeds: [embed] });
}
