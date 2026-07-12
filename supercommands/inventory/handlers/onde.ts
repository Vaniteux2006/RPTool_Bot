import { Message, EmbedBuilder } from 'discord.js';
import { WalletModel } from '../../../tools/models/EconomySchema';
import { resolveOwnedOc, getGuildEconomy, formatMoney } from '../../../tools/utils/economy';

// rp!bag onde ["OC"]  → em quais servidores esse OC tem mochila/carteira.
// Só o DONO pode ver (revela em que servidores o personagem é usado —
// inclusive privados), diferente do rp!bag normal que é público no servidor.
export default async function handleOnde(message: Message, rest: string[], userId: string) {
    const oc = await resolveOwnedOc(rest[0] || '', userId);
    if (!oc) {
        return message.reply(
            rest[0]
                ? `🚫 Você não controla nenhum OC chamado **${rest[0]}**.`
                : '⚠️ Uso: `rp!bag onde "OC"` (ou tenha só um OC pra omitir o nome).',
        );
    }

    const wallets = await WalletModel.find({ ocId: oc._id }).limit(15);
    if (!wallets.length) {
        return message.reply(`📭 **${oc.name}** ainda não tem mochila em nenhum servidor.`);
    }

    const lines = await Promise.all(wallets.map(async w => {
        const guild = message.client.guilds.cache.get(w.guildId);
        const here = w.guildId === message.guild!.id ? ' 📍' : '';
        const econ = await getGuildEconomy(w.guildId);
        const name = guild ? guild.name : '❓ Servidor desconhecido (bot saiu)';
        return `**${name}**${here} — ${w.items.length} tipos de item • ${formatMoney(w.balance, econ)}`;
    }));

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setAuthor({ name: oc.name, iconURL: oc.avatar })
        .setTitle('🗺️ Onde esse OC tem mochila')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `📍 = este servidor • rp!levar "${oc.name}" move a mochila entre servidores` });

    return message.reply({ embeds: [embed] });
}
