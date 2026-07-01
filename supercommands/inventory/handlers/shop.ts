import { Message, EmbedBuilder } from 'discord.js';
import { ItemModel } from '../../../tools/models/EconomySchema';
import { getGuildEconomy, formatMoney, effectivePrice } from '../../../tools/utils/economy';

// rp!inventory shop  → navega o catálogo do servidor.
export default async function handleShop(message: Message, _userId: string) {
    const guildId = message.guild!.id;
    const econ = await getGuildEconomy(guildId);

    const items = await ItemModel.find({ guildId }).sort({ basePrice: 1 }).limit(25);

    if (!items.length) {
        return message.reply('🏪 A loja está vazia. A staff pode criar itens com `rp!inventory additem`.');
    }

    const lines = items.map(it => {
        const price = effectivePrice(it, econ);
        const stock = it.stock < 0 ? '' : ` • estoque: ${it.stock}`;
        const desc = it.description ? `\n> _${it.description.slice(0, 100)}_` : '';
        return `${it.emoji} **${it.name}** — ${formatMoney(price, econ)}${stock}${desc}`;
    });

    const embed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle(`🏪 Loja • ${message.guild!.name}`)
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `Compre com: rp!inventory buy "SeuOC" "item" [qtd]` });

    if (econ.advanced && econ.autoReprice) {
        embed.addFields({ name: '📈 Preços', value: `Reajustados pela inflação (índice ${econ.priceIndex.toFixed(2)}×).` });
    }

    return message.reply({ embeds: [embed] });
}
