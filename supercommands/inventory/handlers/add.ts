import { Message, EmbedBuilder } from 'discord.js';
import { ItemModel } from '../../../tools/models/EconomySchema';
import {
    resolveOwnedOc, slugify, getOrCreateWallet, addItemToWallet, stripMentionTokens,
    sanitizeEmoji, MAX_ITEM_QTY, MAX_DISTINCT_ITEMS, formatQty,
} from '../../../tools/utils/economy';

const MAX_NAME = 60;

// rp!inventory add "MeuOC" "Nome do item" [qtd] [emoji]
// Cria um item PESSOAL (freeform) na mochila do SEU OC — sem preço, fora da loja.
// Serve pra "anotar" itens de RP (uma carta, um amuleto, a espada do pai...).
export default async function handleAdd(message: Message, rest: string[], userId: string) {
    rest = stripMentionTokens(rest);
    const ocName = rest[0];
    const itemName = rest[1];

    if (!ocName || !itemName) {
        return message.reply('⚠️ Uso: `rp!inventory add "MeuOC" "Nome do item" [qtd] [emoji]`.');
    }

    // qtd (numérico) e emoji (não-numérico) opcionais, em qualquer ordem.
    const extra = rest.slice(2);
    const qtyTok = extra.find(t => /^\d+$/.test(t));
    const emojiTok = extra.find(t => !/^\d+$/.test(t));
    const qty = qtyTok ? parseInt(qtyTok, 10) : 1;
    const emoji = sanitizeEmoji(emojiTok, '🎒');

    if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_ITEM_QTY) {
        return message.reply(`⚠️ Quantidade inválida (1 a ${MAX_ITEM_QTY.toLocaleString('pt-BR')} — o limite é da matemática, não do RP).`);
    }
    if (itemName.length > MAX_NAME) {
        return message.reply(`⚠️ Nome muito longo (máx ${MAX_NAME} caracteres).`);
    }

    const guildId = message.guild!.id;

    const oc = await resolveOwnedOc(ocName, userId);
    if (!oc) {
        return message.reply(`🚫 Você não controla nenhum OC chamado **${ocName}**.`);
    }

    const key = slugify(itemName);
    if (!key) {
        return message.reply('⚠️ Nome inválido pra gerar o item.');
    }

    // Se já existe um item de LOJA com essa chave, não deixa criar pessoal de graça.
    const catalogClash = await ItemModel.findOne({ guildId, key });
    if (catalogClash) {
        return message.reply(`🏪 **${catalogClash.name}** é um item da loja — use \`rp!inventory buy "${oc.name}" "${catalogClash.name}"\` em vez de criar um pessoal.`);
    }

    const wallet = await getOrCreateWallet(guildId, oc);
    const already = wallet.items.find(i => i.key === key);
    if (!already && wallet.items.length >= MAX_DISTINCT_ITEMS) {
        return message.reply(`🎒 A mochila de **${oc.name}** atingiu o limite de ${MAX_DISTINCT_ITEMS} tipos de item.`);
    }

    await addItemToWallet(guildId, oc._id, key, qty, { name: itemName, emoji, custom: true });

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setDescription(`✅ **${oc.name}** agora tem **${formatQty(qty)}× ${emoji} ${itemName}** ${already ? '(somado ao que já tinha)' : '_(item pessoal)_'}.`);

    return message.reply({ embeds: [embed] });
}
