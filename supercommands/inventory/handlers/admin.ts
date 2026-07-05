import { Message, EmbedBuilder } from 'discord.js';
import { ItemModel } from '../../../tools/models/EconomySchema';
import {
    isStaff, slugify, parseAmount, resolveItem,
    resolveOcForAdmin, stripMentionTokens, AMBIGUOUS_MSG,
    getOrCreateWallet, addItemToWallet, removeItemFromWallet,
} from '../../../tools/utils/economy';

// ── additem "Nome" <preço> [emoji] ["descrição"] ──────────────────────────────
async function addItem(message: Message, rest: string[]) {
    const [name, priceRaw, emoji, ...descParts] = rest;
    if (!name || !priceRaw) {
        return message.reply('⚠️ Uso: `rp!inventory additem "Nome" <preço> [emoji] ["descrição"]`.');
    }
    const price = parseAmount(priceRaw);
    if (price === null && priceRaw !== '0') {
        return message.reply('⚠️ Preço inválido (inteiro ≥ 0).');
    }
    const guildId = message.guild!.id;
    const key = slugify(name);
    if (!key) return message.reply('⚠️ Nome inválido pra gerar a chave do item.');

    const exists = await ItemModel.findOne({ guildId, key });
    if (exists) return message.reply(`❌ Já existe um item com a chave \`${key}\`. Use \`edititem\`.`);

    await ItemModel.create({
        guildId,
        key,
        name,
        emoji: emoji || '📦',
        description: descParts.join(' ').slice(0, 400),
        basePrice: price ?? 0,
        createdBy: message.author.id,
    });

    return message.reply(`✅ Item **${emoji || '📦'} ${name}** criado (chave: \`${key}\`, preço base: ${price ?? 0}).`);
}

// ── edititem "Nome" <campo> <valor...> ────────────────────────────────────────
// campos: price | name | emoji | desc | stock | tradable | usable | reply
async function editItem(message: Message, rest: string[]) {
    const [name, field, ...valueParts] = rest;
    const value = valueParts.join(' ');
    if (!name || !field) {
        return message.reply('⚠️ Uso: `rp!inventory edititem "Nome" <price|name|emoji|desc|stock|tradable|usable|reply> <valor>`.');
    }

    const guildId = message.guild!.id;
    const item = await resolveItem(guildId, name);
    if (!item) return message.reply(`📭 Item **${name}** não encontrado.`);

    const set: Record<string, unknown> = {};
    switch (field.toLowerCase()) {
        case 'price': case 'preco': case 'preço': {
            const p = parseAmount(value);
            if (p === null && value !== '0') return message.reply('⚠️ Preço inválido.');
            set.basePrice = p ?? 0; break;
        }
        case 'name': case 'nome': set.name = value.slice(0, 80); break;
        case 'emoji': set.emoji = value.slice(0, 8); break;
        case 'desc': case 'descricao': case 'descrição': set.description = value.slice(0, 400); break;
        case 'stock': case 'estoque': {
            const s = value === '-1' ? -1 : parseAmount(value);
            if (s === null && value !== '0') return message.reply('⚠️ Estoque inválido (-1 = ilimitado).');
            set.stock = s ?? 0; break;
        }
        case 'tradable': case 'trocavel': set.tradable = /^(1|true|sim|yes|on)$/i.test(value); break;
        case 'usable': case 'usavel': set.usable = /^(1|true|sim|yes|on)$/i.test(value); break;
        case 'reply': case 'resposta': set.replyOnUse = value.slice(0, 1000); break;
        default:
            return message.reply('⚠️ Campo desconhecido. Use: price, name, emoji, desc, stock, tradable, usable, reply.');
    }

    await ItemModel.updateOne({ guildId, key: item.key }, { $set: set });
    return message.reply(`✅ Item **${item.name}** atualizado (\`${field}\`).`);
}

// ── removeitem "Nome" ─────────────────────────────────────────────────────────
async function removeItem(message: Message, rest: string[]) {
    const name = rest[0];
    if (!name) return message.reply('⚠️ Uso: `rp!inventory removeitem "Nome"`.');
    const guildId = message.guild!.id;
    const item = await resolveItem(guildId, name);
    if (!item) return message.reply(`📭 Item **${name}** não encontrado.`);
    await ItemModel.deleteOne({ guildId, key: item.key });
    return message.reply(`🗑️ Item **${item.name}** removido do catálogo. (As mochilas mantêm o que já tinham.)`);
}

// ── giveitem/takeitem "OC" "item" [qtd] [@dono] ───────────────────────────────
async function transferRaw(message: Message, rest: string[], mode: 'give' | 'take', userId: string) {
    const ocName = rest[0];
    const itemName = rest[1];
    let qty = 1;
    if (rest[2] && /^\d+$/.test(rest[2])) qty = parseInt(rest[2], 10);

    if (!ocName || !itemName) {
        return message.reply(`⚠️ Uso: \`rp!inventory ${mode}item "OC" "item" [qtd]\`.`);
    }

    const guildId = message.guild!.id;
    const res = await resolveOcForAdmin(message, ocName, userId);
    if (res.status === 'ambiguous') return message.reply(AMBIGUOUS_MSG);
    if (res.status === 'notfound') return message.reply(`📭 OC **${ocName}** não encontrado neste servidor. (Se for de outra pessoa, mencione o dono.)`);
    const oc = res.oc;

    const item = await resolveItem(guildId, itemName);
    if (!item) return message.reply(`📭 Item **${itemName}** não existe no catálogo.`);

    if (mode === 'give') {
        await getOrCreateWallet(guildId, oc);
        await addItemToWallet(guildId, oc._id, item.key, qty);
        return message.reply(`✅ Entregue **${qty}× ${item.emoji} ${item.name}** a **${oc.name}**.`);
    } else {
        const ok = await removeItemFromWallet(guildId, oc._id, item.key, qty);
        if (!ok) return message.reply(`🎒 **${oc.name}** não tem ${qty}× **${item.name}**.`);
        return message.reply(`✅ Removido **${qty}× ${item.emoji} ${item.name}** de **${oc.name}**.`);
    }
}

// ─── Roteador administrativo ──────────────────────────────────────────────────
export default async function handleAdmin(message: Message, action: string, rest: string[], userId: string) {
    if (!isStaff(message)) {
        return message.reply('🚫 Só a staff (permissão **Gerenciar Servidor**) pode gerenciar o catálogo/itens.');
    }

    // Menções não são argumentos posicionais (só desambiguam o dono).
    rest = stripMentionTokens(rest);

    switch (action) {
        case 'additem':    return addItem(message, rest);
        case 'edititem':   return editItem(message, rest);
        case 'removeitem': return removeItem(message, rest);
        case 'giveitem':   return transferRaw(message, rest, 'give', userId);
        case 'takeitem':   return transferRaw(message, rest, 'take', userId);
    }
}
