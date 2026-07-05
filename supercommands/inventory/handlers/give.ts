import { Message, EmbedBuilder } from 'discord.js';
import {
    resolveOwnedOc, resolveOcInGuild, stripMentionTokens, AMBIGUOUS_MSG,
    resolveItem, getOrCreateWallet, addItemToWallet, removeItemFromWallet,
} from '../../../tools/utils/economy';

// rp!inventory give "MeuOC" "item" [qtd] "AlvoOC" [@dono]
export default async function handleGive(message: Message, rest: string[], userId: string) {
    rest = stripMentionTokens(rest);
    const fromName = rest[0];
    const itemName = rest[1];

    // qtd é opcional: "..." "item" 3 "Alvo"  vs  "..." "item" "Alvo"
    let qty = 1;
    let toName: string | undefined;
    if (rest.length >= 4 && /^\d+$/.test(rest[2])) {
        qty = parseInt(rest[2], 10);
        toName = rest[3];
    } else {
        toName = rest[2];
    }

    if (!fromName || !itemName || !toName) {
        return message.reply('⚠️ Uso: `rp!inventory give "MeuOC" "item" [qtd] "AlvoOC"`.');
    }
    if (!Number.isFinite(qty) || qty <= 0) {
        return message.reply('⚠️ Quantidade inválida.');
    }

    const guildId = message.guild!.id;

    const fromOc = await resolveOwnedOc(fromName, userId);
    if (!fromOc) {
        return message.reply(`🚫 Você não controla nenhum OC chamado **${fromName}**.`);
    }

    const item = await resolveItem(guildId, itemName);
    if (!item) {
        return message.reply(`📭 O item **${itemName}** não existe no catálogo deste servidor.`);
    }
    if (!item.tradable) {
        return message.reply(`🔒 **${item.name}** não pode ser transferido.`);
    }

    const toRes = await resolveOcInGuild(message, toName, userId);
    if (toRes.status === 'ambiguous') return message.reply(AMBIGUOUS_MSG);
    if (toRes.status === 'notfound') {
        return message.reply(`📭 Não achei o OC de destino **${toName}** neste servidor. (Se o dono for outra pessoa, mencione: \`... "${toName}" @dono\`.)`);
    }
    const toOc = toRes.oc;
    if (String(fromOc._id) === String(toOc._id)) {
        return message.reply('🔁 Origem e destino são o mesmo OC.');
    }

    // Remoção atômica da origem; se não tiver o bastante, aborta antes de creditar.
    const removed = await removeItemFromWallet(guildId, fromOc._id, item.key, qty);
    if (!removed) {
        return message.reply(`🎒 **${fromOc.name}** não tem ${qty}× **${item.name}** pra dar.`);
    }

    await getOrCreateWallet(guildId, toOc);
    await addItemToWallet(guildId, toOc._id, item.key, qty);

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🎁 Item transferido')
        .setDescription(`**${fromOc.name}** deu **${qty}× ${item.emoji} ${item.name}** para **${toOc.name}**.`);

    return message.reply({ embeds: [embed] });
}
