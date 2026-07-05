import { Message, EmbedBuilder } from 'discord.js';
import {
    resolveOwnedOc, resolveItem, removeItemFromWallet, stripMentionTokens,
} from '../../../tools/utils/economy';

// rp!inventory use ["Nome"] "item"  → consome 1 unidade do item.
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

    const item = await resolveItem(guildId, itemName);
    if (!item) {
        return message.reply(`📭 O item **${itemName}** não existe no catálogo deste servidor.`);
    }
    if (!item.usable) {
        return message.reply(`🚫 **${item.name}** não é um item usável.`);
    }

    const ok = await removeItemFromWallet(guildId, oc._id, item.key, 1);
    if (!ok) {
        return message.reply(`🎒 **${oc.name}** não tem **${item.name}** na mochila.`);
    }

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setDescription(`✨ **${oc.name}** usou **${item.emoji} ${item.name}**.`);

    if (item.replyOnUse) {
        embed.addFields({ name: '​', value: item.replyOnUse.slice(0, 1000) });
    }

    return message.reply({ embeds: [embed] });
}
