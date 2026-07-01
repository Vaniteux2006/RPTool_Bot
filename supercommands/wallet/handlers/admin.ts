import { Message, EmbedBuilder } from 'discord.js';
import { OCModel, IOC } from '../../../tools/models/OCSchema';
import { WalletModel, GuildEconomyModel } from '../../../tools/models/EconomySchema';
import {
    isStaff, findOcByName, getOrCreateWallet,
    getGuildEconomy, formatMoney, parseAmount,
} from '../../../tools/utils/economy';
import { recordLedger } from '../../../tools/utils/economyEngine';

// Resolve qualquer OC do servidor (staff mexe em carteira de qualquer um).
async function resolveAnyOc(message: Message, name: string): Promise<IOC | null> {
    const mentioned = message.mentions.users.first();
    if (mentioned) return findOcByName(name, mentioned.id);
    return OCModel.findOne({ name }).collation({ locale: 'pt', strength: 2 });
}

// Comandos administrativos (exigem ManageGuild):
//   add/remove/set "Nome" <valor> | reset "Nome" | setcurrency <nome> <símbolo>
export default async function handleAdmin(message: Message, action: string, rest: string[], _userId: string) {
    if (!isStaff(message)) {
        return message.reply('🚫 Só a staff (permissão **Gerenciar Servidor**) pode usar comandos administrativos da economia.');
    }

    const guildId = message.guild!.id;
    const econ = await getGuildEconomy(guildId);

    // ── Trocar moeda do servidor ──────────────────────────────────────────────
    if (action === 'setcurrency' || action === 'moeda') {
        const [currencyName, symbol] = rest;
        if (!currencyName || !symbol) {
            return message.reply('⚠️ Uso: `rp!wallet setcurrency "Nome da Moeda" <símbolo>` (ex: `rp!wallet setcurrency Créditos 💠`).');
        }
        await GuildEconomyModel.updateOne(
            { guildId },
            { $set: { currencyName: currencyName.slice(0, 40), symbol: symbol.slice(0, 8) } },
        );
        return message.reply(`✅ Moeda do servidor definida: **${currencyName}** (${symbol}).`);
    }

    // ── Demais ações operam sobre um OC ───────────────────────────────────────
    const name = rest[0];
    if (!name) {
        return message.reply('⚠️ Informe o OC. Ex: `rp!wallet add "Ana" 1000`.');
    }

    const oc = await resolveAnyOc(message, name);
    if (!oc) {
        return message.reply(`📭 Não achei o OC **${name}** neste servidor.`);
    }

    const wallet = await getOrCreateWallet(guildId, oc);

    // reset: zera saldo e mochila
    if (action === 'reset' || action === 'zerar') {
        await WalletModel.updateOne(
            { guildId, ocId: oc._id },
            { $set: { balance: 0, items: [], lastActivityAt: new Date() } },
        );
        return message.reply(`♻️ Carteira e mochila de **${oc.name}** foram zeradas.`);
    }

    // add/remove/set precisam de valor
    const amount = parseAmount(rest[1]);
    if (amount === null) {
        return message.reply('⚠️ Valor inválido. Use um inteiro positivo, ex: `rp!wallet add "Ana" 1000`.');
    }

    let newBalance: number;
    if (action === 'add' || action === 'adicionar') {
        newBalance = wallet.balance + amount;
    } else if (action === 'remove' || action === 'remover' || action === 'tirar') {
        newBalance = Math.max(0, wallet.balance - amount);
    } else { // set / definir
        newBalance = amount;
    }

    await WalletModel.updateOne(
        { guildId, ocId: oc._id },
        { $set: { balance: newBalance, lastActivityAt: new Date() } },
    );

    // Faucet (criação) / sink (destruição) de moeda — contexto pro modo avançado.
    if (action === 'add' || action === 'adicionar') recordLedger(guildId, 'faucet', amount);
    else if (action === 'remove' || action === 'remover' || action === 'tirar') recordLedger(guildId, 'sink', amount);

    const verb = (action === 'add' || action === 'adicionar') ? 'Adicionado a'
        : (action === 'set' || action === 'definir') ? 'Definido para'
        : 'Removido de';

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🛠️ Ajuste administrativo')
        .setDescription(`${verb} **${oc.name}**`)
        .addFields(
            { name: 'Operação', value: formatMoney(amount, econ), inline: true },
            { name: 'Novo saldo', value: formatMoney(newBalance, econ), inline: true },
        );

    return message.reply({ embeds: [embed] });
}
