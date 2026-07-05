import { Message, EmbedBuilder } from 'discord.js';
import { WalletModel, ItemModel } from '../../../tools/models/EconomySchema';
import {
    resolveOwnedOc, resolveItem, getOrCreateWallet, removeItemFromWallet,
    getGuildEconomy, formatMoney, effectivePrice, stripMentionTokens,
} from '../../../tools/utils/economy';
import { recordLedger } from '../../../tools/utils/economyEngine';

const SELL_RATE = 0.5; // recebe 50% do preço de mercado ao vender de volta

// rp!inventory sell ["Nome"] "item" [qtd]
export default async function handleSell(message: Message, rest: string[], userId: string) {
    const tokens = stripMentionTokens(rest);

    let qty = 1;
    if (tokens.length && /^\d+$/.test(tokens[tokens.length - 1])) {
        qty = parseInt(tokens.pop() as string, 10);
    }

    const name = tokens.length >= 2 ? tokens[0] : '';
    const itemName = tokens.length >= 2 ? tokens[1] : tokens[0];

    if (!itemName || qty <= 0) {
        return message.reply('⚠️ Uso: `rp!inventory sell "SeuOC" "item" [qtd]`.');
    }

    const guildId = message.guild!.id;

    const oc = await resolveOwnedOc(name, userId);
    if (!oc) {
        return message.reply(name
            ? `🚫 Você não controla nenhum OC chamado **${name}**.`
            : '⚠️ Diga qual OC vai vender: `rp!inventory sell "SeuOC" "item"` (ou tenha só um OC).');
    }

    const item = await resolveItem(guildId, itemName);
    if (!item) {
        return message.reply(`📭 O item **${itemName}** não existe na loja (não dá pra precificar a venda).`);
    }

    const econ = await getGuildEconomy(guildId);
    const refund = Math.floor(effectivePrice(item, econ) * SELL_RATE) * qty;

    // Remove atomicamente da mochila; se não tiver o bastante, aborta.
    const removed = await removeItemFromWallet(guildId, oc._id, item.key, qty);
    if (!removed) {
        return message.reply(`🎒 **${oc.name}** não tem ${qty}× **${item.name}** pra vender.`);
    }

    // Devolve ao estoque da loja (se limitado) e credita o OC.
    if (item.stock >= 0) {
        await ItemModel.updateOne({ guildId, key: item.key }, { $inc: { stock: qty } });
    }
    await getOrCreateWallet(guildId, oc);
    const credited = await WalletModel.findOneAndUpdate(
        { guildId, ocId: oc._id },
        { $inc: { balance: refund }, $set: { lastActivityAt: new Date() } },
        { new: true },
    );

    recordLedger(guildId, 'sell', refund); // alimenta velocidade/PIB (Fase 2)

    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('💱 Venda realizada')
        .setDescription(`**${oc.name}** vendeu **${qty}× ${item.emoji} ${item.name}**.`)
        .addFields(
            { name: 'Recebido', value: formatMoney(refund, econ), inline: true },
            { name: 'Novo saldo', value: formatMoney(credited?.balance ?? 0, econ), inline: true },
        );

    return message.reply({ embeds: [embed] });
}
