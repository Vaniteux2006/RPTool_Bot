import { Message, EmbedBuilder } from 'discord.js';
import {
    resolveTargetOc, getOrCreateWallet, getGuildEconomy, formatMoney,
} from '../../../tools/utils/economy';

// rp!wallet ["Nome"] [@dono]  → mostra o saldo (e itens) de um OC.
export default async function handleView(message: Message, nameTokens: string[], userId: string) {
    // O 1º token pode ser o nome, ou uma @menção (que não é nome).
    const first = nameTokens[0] || '';
    const name = first.startsWith('<@') ? '' : first;

    const oc = await resolveTargetOc(message, name, userId);
    if (!oc) {
        return message.reply(
            "📭 Não achei esse OC. Use `rp!wallet \"Nome\"` (ou tenha só um OC pra poder omitir o nome).",
        );
    }

    const guildId = message.guild!.id;
    const econ = await getGuildEconomy(guildId);
    const wallet = await getOrCreateWallet(guildId, oc);

    const totalItems = wallet.items.reduce((acc, i) => acc + i.qty, 0);

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setAuthor({ name: oc.name, iconURL: oc.avatar })
        .setTitle(`${econ.symbol} Carteira`)
        .setThumbnail(oc.avatar)
        .addFields(
            { name: '💰 Saldo', value: formatMoney(wallet.balance, econ), inline: true },
            { name: '🎒 Mochila', value: `${totalItems} itens (${wallet.items.length} tipos)`, inline: true },
        )
        .setFooter({ text: `${econ.currencyName} • ${message.guild!.name}` });

    // Modo avançado (Fase 2): mostra equivalência fictícia → dólar.
    if (econ.advanced) {
        const usd = wallet.balance * econ.baseUsdRate / (econ.priceIndex || 1);
        embed.addFields({
            name: '💵 Equivalente (USD)',
            value: `$ ${usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
            inline: true,
        });
    }

    return message.reply({ embeds: [embed] });
}
