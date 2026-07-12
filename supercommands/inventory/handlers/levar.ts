import { Message, EmbedBuilder, TextChannel } from 'discord.js';
import { ItemModel, WalletModel, IWalletItem, IItem } from '../../../tools/models/EconomySchema';
import {
    resolveOwnedOc, stripMentionTokens,
    getOrCreateWallet, findHeldItem, addItemToWallet, removeItemFromWallet,
    CustomItemMeta,
} from '../../../tools/utils/economy';
import { IOC } from '../../../tools/models/OCSchema';

// rp!levar ["OC"]                      → leva a MOCHILA INTEIRA pra outro servidor
// rp!levar "item" [qtd] "OC"           → leva só aquele item (qtd omitida = tudo)
// (também acessível como rp!bag levar ...)
//
// O comando roda no servidor ONDE OS ITENS ESTÃO. Um embed lista os outros
// servidores em que o OC tem mochila (numerados) e o dono responde 1, 2, 3...
// É MOVER, não copiar — o personagem carrega UMA mochila (sem dupe entre servers).
//
// Regras de item na chegada:
//   • pessoal (✎)                     → vai como está (carrega nome/emoji próprios)
//   • de loja, destino TEM o key      → mapeia pro catálogo do destino
//   • de loja, destino NÃO tem o key  → vira item pessoal (perde preço/venda)
//   • de loja com tradable: false     → NÃO viaja (fica preso ao servidor de origem)
//   • 💰 saldo nunca viaja — cada servidor é uma economia própria.

// Trava por OC: impede dois `levar` simultâneos duplicarem a mesma mochila.
const inFlight = new Set<string>();

const MAX_DISTINCT = 100; // mesmo cap de tipos por mochila do handlers/add.ts

interface MovePlan {
    item: IWalletItem;       // snapshot do item na origem
    qty: number;             // quanto mover
    meta?: CustomItemMeta;   // definido → chega como item pessoal
    label: string;           // "emoji Nome" pra exibição
    converted: boolean;      // virou pessoal na viagem
}

export default async function handleLevar(message: Message, rest: string[], userId: string) {
    rest = stripMentionTokens(rest);

    // ── Parse: [ ] | ["OC"] | ["tudo" "OC"] | ["item" "OC"] | ["item" qtd "OC"] ──
    let ocName = '';
    let itemName: string | undefined;
    let wantedQty: number | undefined; // undefined = pilha inteira

    if (rest.length <= 1) {
        ocName = rest[0] || '';
    } else if (['tudo', 'all', 'mochila', 'bag'].includes(rest[0].toLowerCase())) {
        ocName = rest[1];
    } else if (rest.length >= 3 && /^\d+$/.test(rest[1])) {
        itemName = rest[0];
        wantedQty = parseInt(rest[1], 10);
        ocName = rest[2];
    } else {
        itemName = rest[0];
        ocName = rest[1];
    }
    if (wantedQty !== undefined && (!Number.isFinite(wantedQty) || wantedQty <= 0)) {
        return message.reply('⚠️ Quantidade inválida.');
    }

    // ── OC: precisa ser SEU (a mochila viaja com o personagem, só o dono leva) ──
    const oc = await resolveOwnedOc(ocName, userId);
    if (!oc) {
        return message.reply(
            ocName
                ? `🚫 Você não controla nenhum OC chamado **${ocName}**.`
                : '⚠️ Uso: `rp!levar "OC"` (mochila inteira) ou `rp!levar "item" [qtd] "OC"`.',
        );
    }

    const srcGuildId = message.guild!.id;
    const srcWallet = await getOrCreateWallet(srcGuildId, oc);

    // ── O que vai viajar? ────────────────────────────────────────────────────
    let candidates: { item: IWalletItem; qty: number }[];
    if (itemName) {
        const held = findHeldItem(srcWallet, itemName);
        if (!held) {
            return message.reply(`🎒 **${oc.name}** não tem **${itemName}** na mochila deste servidor.`);
        }
        const qty = wantedQty ?? held.qty;
        if (qty > held.qty) {
            return message.reply(`🎒 **${oc.name}** só tem **${held.qty}×** desse item aqui.`);
        }
        candidates = [{ item: held, qty }];
    } else {
        if (!srcWallet.items.length) {
            return message.reply(`🎒 A mochila de **${oc.name}** está vazia neste servidor — nada pra levar.`);
        }
        candidates = srcWallet.items.map(i => ({ item: i, qty: i.qty }));
    }

    // ── Destinos: servidores onde o OC JÁ tem carteira (rp!bag lá cria uma) ──
    const wallets = await WalletModel.find({ ocId: oc._id, guildId: { $ne: srcGuildId } });
    const destinations = wallets
        .map(w => ({ wallet: w, guild: message.client.guilds.cache.get(w.guildId) }))
        .filter((d): d is { wallet: typeof d.wallet; guild: NonNullable<typeof d.guild> } => !!d.guild)
        .slice(0, 9);

    if (!destinations.length) {
        return message.reply(
            `🧳 Não achei mochila de **${oc.name}** em nenhum outro servidor.\n` +
            '> Pra um servidor aparecer como destino, use `rp!bag` lá uma vez (isso registra a mochila do OC).',
        );
    }

    // ── Embed numerado: "pra onde levar?" ────────────────────────────────────
    const what = itemName
        ? `**${candidates[0].qty}× ${candidates[0].item.emoji || '📦'} ${candidates[0].item.name || candidates[0].item.key}**`
        : `a **mochila inteira** (${srcWallet.items.length} tipos de item)`;

    const destLines = destinations.map((d, i) =>
        `**${i + 1}.** ${d.guild.name} — ${d.wallet.items.length} tipos de item`);

    const askEmbed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setAuthor({ name: oc.name, iconURL: oc.avatar })
        .setTitle('🧳 Levar pra onde?')
        .setDescription(
            `Levando ${what} de **${message.guild!.name}** para:\n\n${destLines.join('\n')}\n\n` +
            '> Os itens são **movidos** (não copiados). 💰 O saldo não viaja — cada servidor tem sua própria moeda.',
        )
        .setFooter({ text: 'Responda com o número do servidor • "cancelar" pra abortar • 60s' });

    await message.reply({ embeds: [askEmbed] });

    // ── Coleta a escolha (1, 2, 3... ou cancelar) ─────────────────────────────
    let choice: number;
    try {
        const collected = await (message.channel as TextChannel).awaitMessages({
            filter: (m: Message) =>
                m.author.id === userId && (/^\d{1,2}$/.test(m.content.trim()) || /^cancelar$/i.test(m.content.trim())),
            max: 1,
            time: 60_000,
            errors: ['time'],
        });
        const answer = collected.first()!.content.trim();
        if (/^cancelar$/i.test(answer)) {
            return message.reply('🛑 Transferência cancelada.');
        }
        choice = parseInt(answer, 10);
    } catch {
        return message.reply('⌛ Tempo esgotado — transferência cancelada.');
    }

    const dest = destinations[choice - 1];
    if (!dest) {
        return message.reply(`⚠️ Escolha entre **1** e **${destinations.length}**. Rode o comando de novo.`);
    }
    const destGuildId = dest.wallet.guildId;

    if (inFlight.has(String(oc._id))) {
        return message.reply('⏳ Já existe uma transferência em andamento pra esse OC. Aguarde ela terminar.');
    }
    inFlight.add(String(oc._id));

    try {
        // ── Cataloga origem e destino em UMA query cada (tradable + mapeamento) ──
        const shopKeys = candidates.filter(c => !c.item.custom).map(c => c.item.key);
        const noItems: IItem[] = [];
        const [srcCatalog, destCatalog] = await Promise.all([
            shopKeys.length ? ItemModel.find({ guildId: srcGuildId, key: { $in: shopKeys } }) : noItems,
            shopKeys.length ? ItemModel.find({ guildId: destGuildId, key: { $in: shopKeys } }) : noItems,
        ]);
        const srcByKey = new Map<string, IItem>(srcCatalog.map((c: IItem): [string, IItem] => [c.key, c]));
        const destKeys = new Set(destCatalog.map((c: IItem) => c.key));

        const plans: MovePlan[] = [];
        const locked: string[] = []; // tradable: false — ficam aqui

        for (const { item, qty } of candidates) {
            if (item.custom) {
                // Pessoal: autossuficiente, viaja como está.
                plans.push({
                    item, qty,
                    meta: { name: item.name || item.key, emoji: item.emoji || '🎒', custom: true },
                    label: `${item.emoji || '🎒'} ${item.name || item.key} ✎`,
                    converted: false,
                });
                continue;
            }
            const cat = srcByKey.get(item.key);
            if (cat && !cat.tradable) {
                locked.push(`🔒 ${cat.emoji} ${cat.name}`);
                continue;
            }
            const name = cat?.name || item.key;
            const emoji = cat?.emoji || '📦';
            if (destKeys.has(item.key)) {
                // Destino conhece o item: chega como item de loja de lá.
                plans.push({ item, qty, label: `${emoji} ${name}`, converted: false });
            } else {
                // Destino não tem no catálogo: vira item pessoal na chegada.
                plans.push({
                    item, qty,
                    meta: { name, emoji, custom: true },
                    label: `${emoji} ${name}`,
                    converted: true,
                });
            }
        }

        if (!plans.length) {
            return message.reply(
                `🔒 Nada pôde viajar: ${locked.join(', ')} ${locked.length > 1 ? 'são itens presos' : 'é um item preso'} a este servidor (não transferível).`,
            );
        }

        // ── Cap de tipos no destino (mesmo limite do `add`) ──────────────────
        const destWallet = await getOrCreateWallet(destGuildId, oc);
        const destHeld = new Set(destWallet.items.map(i => i.key));
        const newTypes = plans.filter(p => !destHeld.has(p.item.key)).length;
        if (destWallet.items.length + newTypes > MAX_DISTINCT) {
            return message.reply(
                `🎒 A mochila de **${oc.name}** em **${dest.guild.name}** estouraria o limite de ${MAX_DISTINCT} tipos de item. Leve menos itens por vez (\`rp!levar "item" "${oc.name}"\`).`,
            );
        }

        // ── Move item a item: débito ATÔMICO na origem → crédito no destino ──
        // (mesma ordem do give: se algo falhar no meio, nunca há duplicação)
        const moved: string[] = [];
        for (const p of plans) {
            const removed = await removeItemFromWallet(srcGuildId, oc._id, p.item.key, p.qty);
            if (!removed) continue; // mudou embaixo de nós (drop/give concorrente) — pula
            await addItemToWallet(destGuildId, oc._id, p.item.key, p.qty, p.meta);
            moved.push(`**${p.qty}×** ${p.label}${p.converted ? ' → virou pessoal ✎' : ''}`);
        }

        if (!moved.length) {
            return message.reply('🎒 Nada foi movido — a mochila mudou enquanto você escolhia o destino.');
        }

        const MAX_LINES = 15;
        const shown = moved.slice(0, MAX_LINES);
        if (moved.length > MAX_LINES) shown.push(`… e mais **${moved.length - MAX_LINES}** itens.`);
        if (locked.length) shown.push(`\n${locked.join('\n')} — não transferível, ficou em **${message.guild!.name}**.`);

        const doneEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setAuthor({ name: oc.name, iconURL: oc.avatar })
            .setTitle('🧳 Mudança concluída!')
            .setDescription(`**${oc.name}** levou pra **${dest.guild.name}**:\n\n${shown.join('\n')}`)
            .setFooter({ text: `Veja lá com rp!bag "${oc.name}" • ✎ = item pessoal` });

        return message.reply({ embeds: [doneEmbed] });
    } finally {
        inFlight.delete(String(oc._id));
    }
}
