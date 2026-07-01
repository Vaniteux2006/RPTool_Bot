import { Message, EmbedBuilder } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { WalletModel } from '../../../tools/models/EconomySchema';
import {
    resolveOwnedOc, findOcByName, getOrCreateWallet,
    getGuildEconomy, formatMoney, parseAmount,
} from '../../../tools/utils/economy';
import { recordLedger } from '../../../tools/utils/economyEngine';

// rp!wallet pay "MeuOC" <valor> "AlvoOC" [@dono]
// Transferência atômica entre carteiras. O OC de origem tem que ser SEU.
export default async function handlePay(message: Message, rest: string[], userId: string) {
    const [fromName, amountRaw, toName] = rest;

    if (!fromName || !amountRaw || !toName) {
        return message.reply('⚠️ Uso: `rp!wallet pay "MeuOC" <valor> "AlvoOC"` (mencione o dono se o alvo for de outra pessoa).');
    }

    const amount = parseAmount(amountRaw);
    if (amount === null) {
        return message.reply('⚠️ Valor inválido. Use um número inteiro positivo, ex: `rp!wallet pay "Ana" 500 "Beto"`.');
    }

    const guildId = message.guild!.id;

    // Origem: precisa ser um OC controlado pelo autor.
    const fromOc = await resolveOwnedOc(fromName, userId);
    if (!fromOc) {
        return message.reply(`🚫 Você não controla nenhum OC chamado **${fromName}**.`);
    }

    // Destino: se houver @menção, procura entre os OCs dela; senão entre os seus,
    // e por fim faz uma busca global pelo nome no servidor.
    const mentioned = message.mentions.users.first();
    let toOc = mentioned
        ? await findOcByName(toName, mentioned.id)
        : (await findOcByName(toName, userId))
            ?? await OCModel.findOne({ name: toName }).collation({ locale: 'pt', strength: 2 });

    if (!toOc) {
        return message.reply(`📭 Não achei o OC de destino **${toName}**.`);
    }

    if (String(fromOc._id) === String(toOc._id)) {
        return message.reply('🔁 Origem e destino são o mesmo OC.');
    }

    const econ = await getGuildEconomy(guildId);

    // Garante que a carteira de origem existe antes do débito condicional.
    await getOrCreateWallet(guildId, fromOc);

    // Débito ATÔMICO: só desconta se houver saldo suficiente (evita corrida).
    const debited = await WalletModel.findOneAndUpdate(
        { guildId, ocId: fromOc._id, balance: { $gte: amount } },
        { $inc: { balance: -amount }, $set: { lastActivityAt: new Date() } },
        { new: true },
    );

    if (!debited) {
        return message.reply(`💸 **${fromOc.name}** não tem saldo suficiente pra transferir ${formatMoney(amount, econ)}.`);
    }

    // Crédito no destino (cria a carteira se necessário).
    await getOrCreateWallet(guildId, toOc);
    await WalletModel.updateOne(
        { guildId, ocId: toOc._id },
        { $inc: { balance: amount }, $set: { lastActivityAt: new Date() } },
    );

    recordLedger(guildId, 'transfer', amount); // alimenta velocidade/PIB (Fase 2)

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('✅ Transferência concluída')
        .setDescription(`**${fromOc.name}** → **${toOc.name}**`)
        .addFields(
            { name: 'Valor', value: formatMoney(amount, econ), inline: true },
            { name: `Saldo de ${fromOc.name}`, value: formatMoney(debited.balance, econ), inline: true },
        )
        .setFooter({ text: `${econ.currencyName} • ${message.guild!.name}` });

    return message.reply({ embeds: [embed] });
}
