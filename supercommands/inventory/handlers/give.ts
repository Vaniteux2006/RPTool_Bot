import { Message, EmbedBuilder } from 'discord.js';
import { ItemModel } from '../../../tools/models/EconomySchema';
import {
    resolveOwnedOc, resolveOcInGuild, stripMentionTokens, AMBIGUOUS_MSG,
    getOrCreateWallet, findHeldItem, addItemToWallet, removeItemFromWallet, formatQty,
} from '../../../tools/utils/economy';

// rp!inventory give "MeuOC" "item" [qtd] "AlvoOC" [@dono]
// Transfere um item que o OC POSSUI — de catálogo OU pessoal (freeform).
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

    // O item precisa estar NA MOCHILA do OC de origem (posse), não no catálogo.
    const fromWallet = await getOrCreateWallet(guildId, fromOc);
    const held = findHeldItem(fromWallet, itemName);
    if (!held) {
        return message.reply(`🎒 **${fromOc.name}** não tem **${itemName}** na mochila.`);
    }

    // Nome/emoji de exibição + regra de "tradable" dependem da origem do item.
    let displayName = held.name || held.key;
    let displayEmoji = held.emoji || '📦';
    if (!held.custom) {
        // Item de catálogo: respeita a flag `tradable` e usa nome/emoji do catálogo.
        const cat = await ItemModel.findOne({ guildId, key: held.key });
        if (cat) {
            displayName = cat.name;
            displayEmoji = cat.emoji;
            if (!cat.tradable) {
                return message.reply(`🔒 **${cat.name}** não pode ser transferido.`);
            }
        }
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
    const removed = await removeItemFromWallet(guildId, fromOc._id, held.key, qty);
    if (!removed) {
        return message.reply(`🎒 **${fromOc.name}** não tem ${formatQty(qty)}× **${displayName}** pra dar.`);
    }

    // Itens pessoais carregam nome/emoji pro destino (o catálogo resolve sozinho).
    const meta = held.custom
        ? { name: displayName, emoji: displayEmoji, custom: true as const }
        : undefined;
    await getOrCreateWallet(guildId, toOc);
    await addItemToWallet(guildId, toOc._id, held.key, qty, meta);

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🎁 Item transferido')
        .setDescription(`**${fromOc.name}** deu **${formatQty(qty)}× ${displayEmoji} ${displayName}** para **${toOc.name}**.`);

    return message.reply({ embeds: [embed] });
}
