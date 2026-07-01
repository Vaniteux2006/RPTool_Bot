import { Message, EmbedBuilder } from 'discord.js';
import { WalletModel, ItemModel } from '../../../tools/models/EconomySchema';
import {
    resolveOwnedOc, resolveItem, getOrCreateWallet, addItemToWallet,
    getGuildEconomy, formatMoney, effectivePrice,
} from '../../../tools/utils/economy';
import { recordLedger } from '../../../tools/utils/economyEngine';

// rp!inventory buy ["Nome"] "item" [qtd]
export default async function handleBuy(message: Message, rest: string[], userId: string) {
    const tokens = [...rest];

    // qtd opcional no final
    let qty = 1;
    if (tokens.length && /^\d+$/.test(tokens[tokens.length - 1])) {
        qty = parseInt(tokens.pop() as string, 10);
    }

    // Sobrou [Nome, item] ou só [item] (OC único).
    const name = tokens.length >= 2 ? tokens[0] : '';
    const itemName = tokens.length >= 2 ? tokens[1] : tokens[0];

    if (!itemName || qty <= 0) {
        return message.reply('⚠️ Uso: `rp!inventory buy "SeuOC" "item" [qtd]`.');
    }

    const guildId = message.guild!.id;

    const oc = await resolveOwnedOc(name, userId);
    if (!oc) {
        return message.reply(name
            ? `🚫 Você não controla nenhum OC chamado **${name}**.`
            : '⚠️ Diga qual OC vai comprar: `rp!inventory buy "SeuOC" "item"` (ou tenha só um OC).');
    }

    const item = await resolveItem(guildId, itemName);
    if (!item) {
        return message.reply(`📭 O item **${itemName}** não existe na loja.`);
    }

    const econ = await getGuildEconomy(guildId);
    const unit = effectivePrice(item, econ);
    const total = unit * qty;

    // 1) Reserva de estoque (atômica) quando limitado.
    if (item.stock >= 0) {
        const reserved = await ItemModel.findOneAndUpdate(
            { guildId, key: item.key, stock: { $gte: qty } },
            { $inc: { stock: -qty } },
            { new: true },
        );
        if (!reserved) {
            return message.reply(`📦 Estoque insuficiente de **${item.name}** (restam ${item.stock}).`);
        }
    }

    // 2) Débito (atômico). Se falhar, devolve o estoque reservado.
    await getOrCreateWallet(guildId, oc);
    const debited = await WalletModel.findOneAndUpdate(
        { guildId, ocId: oc._id, balance: { $gte: total } },
        { $inc: { balance: -total }, $set: { lastActivityAt: new Date() } },
        { new: true },
    );

    if (!debited) {
        if (item.stock >= 0) {
            await ItemModel.updateOne({ guildId, key: item.key }, { $inc: { stock: qty } });
        }
        return message.reply(`💸 **${oc.name}** não tem ${formatMoney(total, econ)} pra comprar ${qty}× **${item.name}**.`);
    }

    // 3) Entrega do item.
    await addItemToWallet(guildId, oc._id, item.key, qty);

    recordLedger(guildId, 'buy', total); // alimenta velocidade/PIB (Fase 2)

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🛒 Compra realizada')
        .setDescription(`**${oc.name}** comprou **${qty}× ${item.emoji} ${item.name}**.`)
        .addFields(
            { name: 'Custo', value: formatMoney(total, econ), inline: true },
            { name: 'Novo saldo', value: formatMoney(debited.balance, econ), inline: true },
        );

    return message.reply({ embeds: [embed] });
}
