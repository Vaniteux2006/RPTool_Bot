import { Message, EmbedBuilder } from 'discord.js';
import { ItemModel } from '../../../tools/models/EconomySchema';
import {
    resolveOwnedOc, getOrCreateWallet, findHeldItem, removeItemFromWallet, stripMentionTokens,
} from '../../../tools/utils/economy';

// rp!inventory use ["Nome"] "item"  → consome 1 unidade (de catálogo OU pessoal).
export default async function handleUse(message: Message, rest: string[], userId: string) {
    rest = stripMentionTokens(rest);
    // Com 2 tokens: "Nome" "item". Com 1: usa o OC único do autor.
    const name = rest.length >= 2 ? rest[0] : '';
    const itemName = rest.length >= 2 ? rest[1] : rest[0];

    if (!itemName) {
        return message.reply('⚠️ Uso: `rp!inventory use "Nome" "item"`.');
    }

    const guildId = message.guild!.id;

    const oc = await resolveOwnedOc(name, userId);
    if (!oc) {
        return message.reply(name
            ? `🚫 Você não controla nenhum OC chamado **${name}**.`
            : '⚠️ Diga qual OC: `rp!inventory use "Nome" "item"` (ou tenha só um OC).');
    }

    // Precisa TER o item na mochila (catálogo ou pessoal).
    const wallet = await getOrCreateWallet(guildId, oc);
    const held = findHeldItem(wallet, itemName);
    if (!held) {
        return message.reply(`🎒 **${oc.name}** não tem **${itemName}** na mochila.`);
    }

    let displayName = held.name || held.key;
    let displayEmoji = held.emoji || '📦';
    let replyOnUse = '';

    if (!held.custom) {
        const cat = await ItemModel.findOne({ guildId, key: held.key });
        if (cat) {
            displayName = cat.name;
            displayEmoji = cat.emoji;
            replyOnUse = cat.replyOnUse;
            if (!cat.usable) {
                return message.reply(`🚫 **${cat.name}** não é um item usável.`);
            }
        }
    }

    const ok = await removeItemFromWallet(guildId, oc._id, held.key, 1);
    if (!ok) {
        return message.reply(`🎒 **${oc.name}** não tem **${displayName}** na mochila.`);
    }

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setDescription(`✨ **${oc.name}** usou **${displayEmoji} ${displayName}**.`);

    if (replyOnUse) {
        embed.addFields({ name: '​', value: replyOnUse.slice(0, 1000) });
    }

    return message.reply({ embeds: [embed] });
}
