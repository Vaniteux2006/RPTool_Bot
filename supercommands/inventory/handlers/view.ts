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

    // Itens pessoais (custom) carregam nome/emoji próprios; os de loja resolvem
    // pelo catálogo (que pode ter sido removido — cai no key como fallback).
    const catalogKeys = wallet.items.filter(i => !i.custom).map(i => i.key);
    const catalog = catalogKeys.length ? await ItemModel.find({ guildId, key: { $in: catalogKeys } }) : [];
    const metaByKey = new Map(catalog.map(c => [c.key, { name: c.name, emoji: c.emoji }]));

    let hasCustom = false;
    const lines = wallet.items
        .slice()
        .sort((a, b) => b.qty - a.qty)
        .map(i => {
            let label: string;
            if (i.custom) {
                hasCustom = true;
                label = `${i.emoji || '🎒'} ${i.name || i.key} ✎`; // ✎ marca item pessoal
            } else {
                const meta = metaByKey.get(i.key);
                label = meta ? `${meta.emoji} ${meta.name}` : `📦 ${i.key}`;
            }
            return `**${i.qty}×** ${label}`;
        });

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setAuthor({ name: oc.name, iconURL: oc.avatar })
        .setTitle('🎒 Mochila')
        .setThumbnail(oc.avatar)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${wallet.items.length} tipos de item${hasCustom ? ' • ✎ = pessoal' : ''} • ${message.guild!.name}` });

    return message.reply({ embeds: [embed] });
}
