import { Message, EmbedBuilder } from 'discord.js';
import { ItemModel } from '../../../tools/models/EconomySchema';
import {
    resolveOcInGuild, explicitMention, getSoleOc, AMBIGUOUS_MSG,
    getOrCreateWallet, getGuildEconomy,
} from '../../../tools/utils/economy';
import { IOC } from '../../../tools/models/OCSchema';

// rp!inventory ["Nome"] [@dono]  → lista a mochila de um OC.
export default async function handleView(message: Message, nameTokens: string[], userId: string) {
    const first = nameTokens[0] || '';
    const name = first.startsWith('<@') ? '' : first;

    let oc: IOC | null = null;
    if (name) {
        const res = await resolveOcInGuild(message, name, userId);
        if (res.status === 'ambiguous') return message.reply(AMBIGUOUS_MSG);
        oc = res.status === 'found' ? res.oc : null;
    } else {
        const mentioned = explicitMention(message);
        oc = await getSoleOc(mentioned ? mentioned.id : userId);
    }

    if (!oc) {
        return message.reply(
            "📭 Não achei esse OC. Use `rp!inventory \"Nome\"` (ou tenha só um OC pra omitir o nome).",
        );
    }

    const guildId = message.guild!.id;
    const econ = await getGuildEconomy(guildId);
    const wallet = await getOrCreateWallet(guildId, oc);

    if (!wallet.items.length) {
        return message.reply(`🎒 A mochila de **${oc.name}** está vazia.`);
    }

    // Resolve nome/emoji dos itens a partir do catálogo (pode ter item removido).
    const keys = wallet.items.map(i => i.key);
    const catalog = await ItemModel.find({ guildId, key: { $in: keys } });
    const metaByKey = new Map(catalog.map(c => [c.key, { name: c.name, emoji: c.emoji }]));

    const lines = wallet.items
        .slice()
        .sort((a, b) => b.qty - a.qty)
        .map(i => {
            const meta = metaByKey.get(i.key);
            const label = meta ? `${meta.emoji} ${meta.name}` : `📦 ${i.key}`;
            return `**${i.qty}×** ${label}`;
        });

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setAuthor({ name: oc.name, iconURL: oc.avatar })
        .setTitle('🎒 Mochila')
        .setThumbnail(oc.avatar)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${wallet.items.length} tipos de item • ${message.guild!.name}` });

    return message.reply({ embeds: [embed] });
}
