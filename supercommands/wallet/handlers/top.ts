import { Message, EmbedBuilder } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { WalletModel } from '../../../tools/models/EconomySchema';
import { getGuildEconomy, formatMoney } from '../../../tools/utils/economy';

const MEDALS = ['🥇', '🥈', '🥉'];

// rp!wallet top  → ranking dos OCs mais ricos do servidor.
export default async function handleTop(message: Message, _userId: string) {
    const guildId = message.guild!.id;
    const econ = await getGuildEconomy(guildId);

    const wallets = await WalletModel.find({ guildId, balance: { $gt: 0 } })
        .sort({ balance: -1 })
        .limit(10);

    if (!wallets.length) {
        return message.reply('🏜️ Ninguém tem dinheiro nesse servidor ainda. Comecem a economia!');
    }

    // Resolve nomes dos OCs (conexão separada — não dá pra popular direto).
    const ocs = await OCModel.find({ _id: { $in: wallets.map(w => w.ocId) } });
    const nameById = new Map(ocs.map(o => [String(o._id), o.name]));

    const lines = wallets.map((w, idx) => {
        const rank = MEDALS[idx] || `**${idx + 1}.**`;
        const name = nameById.get(String(w.ocId)) || 'OC desconhecido';
        return `${rank} **${name}** — ${formatMoney(w.balance, econ)}`;
    });

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`${econ.symbol} Ranking de Riqueza`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${econ.currencyName} • ${message.guild!.name}` });

    return message.reply({ embeds: [embed] });
}
