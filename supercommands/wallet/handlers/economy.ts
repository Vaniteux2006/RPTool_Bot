import { Message, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import axios from 'axios';
import { GuildEconomyModel, IGuildEconomy } from '../../../tools/models/EconomySchema';
import { isStaff, formatMoney, getGuildEconomy } from '../../../tools/utils/economy';
import { recomputeEconomy, enableAdvanced, rebaseline, coinToUsd } from '../../../tools/utils/economyEngine';

const ON = ['on', 'ligar', 'sim', 'yes', '1', 'true', 'ativar'];
const OFF = ['off', 'desligar', 'nao', 'não', '0', 'false', 'desativar'];

// Gráfico de linha (baixa do QuickChart e anexa — o proxy do Discord não busca
// serviços externos de imagem).
async function lineChart(labels: string[], data: number[], name = 'economia.png'): Promise<AttachmentBuilder | null> {
    try {
        const cfg = {
            type: 'line',
            data: { labels, datasets: [{ data, borderColor: '#f1c40f', backgroundColor: 'rgba(241,196,15,0.15)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }] },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#8e9297', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
                    y: { ticks: { color: '#8e9297', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                },
            },
        };
        const url = `https://quickchart.io/chart?bkg=${encodeURIComponent('#2b2d31')}&w=700&h=250&c=${encodeURIComponent(JSON.stringify(cfg))}`;
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        return new AttachmentBuilder(Buffer.from(res.data), { name });
    } catch {
        return null; // gráfico é opcional — não quebra o dashboard
    }
}

// ─── rp!wallet economia [avancada|reajuste|dolar|reset] ───────────────────────
export default async function handleEconomy(message: Message, rest: string[], _userId: string) {
    const guildId = message.guild!.id;
    const sub = (rest[0] || '').toLowerCase();
    const arg = (rest[1] || '').toLowerCase();

    // ── Ligar/desligar o modo avançado ────────────────────────────────────────
    if (['avancada', 'avançada', 'advanced', 'avancado', 'avançado'].includes(sub)) {
        if (!isStaff(message)) return message.reply('🚫 Só a staff pode mexer no modo econômico.');
        if (OFF.includes(arg)) {
            await GuildEconomyModel.updateOne({ guildId }, { $set: { advanced: false } });
            return message.reply('📴 Modo avançado **desligado**. Preços voltam ao valor base e a inflação para de ser calculada.');
        }
        const econ = await enableAdvanced(guildId);
        return message.reply(
            '🧠 Modo avançado **ligado**!\n' +
            `Capturei o estado atual como marco zero (M0 = ${formatMoney(econ.genesisMoneySupply, econ)}, riqueza base = ${econ.genesisRealWealth.toLocaleString('pt-BR')}).\n` +
            '💡 Dica: ligue **depois** de já ter dinheiro e itens circulando, pra a inflação fazer sentido. Ative o reajuste de preços com `rp!wallet economia reajuste on`.',
        );
    }

    // ── Ligar/desligar o reajuste de preços ───────────────────────────────────
    if (['reajuste', 'reprice', 'precos', 'preços'].includes(sub)) {
        if (!isStaff(message)) return message.reply('🚫 Só a staff pode mexer no reajuste de preços.');
        const on = ON.includes(arg);
        await GuildEconomyModel.updateOne({ guildId }, { $set: { autoReprice: on } });
        const econ = await getGuildEconomy(guildId);
        const warn = on && !econ.advanced ? '\n⚠️ O modo avançado está desligado — o reajuste só age com ele ligado.' : '';
        return message.reply(`${on ? '📈 Reajuste de preços **ligado**' : '📉 Reajuste de preços **desligado**'}. Os preços da loja ${on ? 'passam a acompanhar a inflação' : 'voltam ao valor base'}.${warn}`);
    }

    // ── Definir a taxa de câmbio fictícia (1 moeda = X dólares no genesis) ─────
    if (['dolar', 'dólar', 'usd', 'rate', 'cambio', 'câmbio'].includes(sub)) {
        if (!isStaff(message)) return message.reply('🚫 Só a staff pode definir o câmbio.');
        const rate = parseFloat((rest[1] || '').replace(',', '.'));
        if (!Number.isFinite(rate) || rate <= 0) {
            return message.reply('⚠️ Uso: `rp!wallet economia dolar <valor>` (ex: `0.5` = 1 moeda vale US$ 0,50).');
        }
        await GuildEconomyModel.updateOne({ guildId }, { $set: { baseUsdRate: rate } });
        return message.reply(`💵 Câmbio base definido: **1 moeda = US$ ${rate.toLocaleString('en-US', { maximumFractionDigits: 4 })}** (no marco zero).`);
    }

    // ── Re-capturar os baselines ──────────────────────────────────────────────
    if (['reset', 'rebaseline', 'recalibrar'].includes(sub)) {
        if (!isStaff(message)) return message.reply('🚫 Só a staff pode recalibrar a economia.');
        const econ = await getGuildEconomy(guildId);
        if (!econ.advanced) return message.reply('⚠️ Ligue o modo avançado primeiro: `rp!wallet economia avancada on`.');
        await rebaseline(guildId);
        return message.reply('♻️ Marco zero recalibrado com o estado atual. O índice de preço volta a **1,00×**.');
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────
    const econ = await recomputeEconomy(guildId);
    const last = econ.history[econ.history.length - 1];
    const gdp = last?.gdp ?? 0;

    const embed = new EmbedBuilder()
        .setColor(econ.advanced ? 0xF1C40F : 0x95A5A6)
        .setTitle(`📊 Economia • ${message.guild!.name}`)
        .setDescription(`Moeda: **${econ.currencyName}** ${econ.symbol} • Modo: ${econ.advanced ? '🧠 **Avançado**' : '💤 Simples'}`)
        .addFields(
            { name: '💰 Oferta monetária (M)', value: formatMoney(econ.moneySupply, econ), inline: true },
            { name: '🏦 Riqueza real (Q)', value: formatMoney(econ.realWealth, econ), inline: true },
        );

    if (econ.advanced) {
        const inflationPct = (econ.priceIndex - 1) * 100;
        const inflStr = `${inflationPct >= 0 ? '📈 +' : '📉 '}${inflationPct.toFixed(1)}%`;
        embed.addFields(
            { name: '🎯 Índice de preço', value: `${econ.priceIndex.toFixed(2)}× (${inflStr})`, inline: true },
            { name: '🔄 Velocidade (V)', value: econ.velocity.toFixed(3), inline: true },
            { name: `📦 PIB (${'7d'})`, value: formatMoney(Math.round(gdp), econ), inline: true },
            { name: '💵 Câmbio', value: `1 ${econ.symbol} ≈ US$ ${coinToUsd(1, econ).toLocaleString('en-US', { maximumFractionDigits: 4 })}`, inline: true },
            { name: '🌎 Economia em USD', value: `$ ${coinToUsd(econ.moneySupply, econ).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, inline: true },
            { name: '🏷️ Reajuste de preços', value: econ.autoReprice ? '📈 Ligado' : '📉 Desligado', inline: true },
        );
    } else {
        embed.addFields({
            name: '💡 Modo avançado',
            value: 'Desligado. Ligue com `rp!wallet economia avancada on` pra ativar inflação, PIB, câmbio em dólar e reajuste de preços.',
        });
    }

    embed.setFooter({ text: econ.advanced && econ.advancedSince ? `Avançado desde ${econ.advancedSince.toLocaleDateString('pt-BR')}` : 'RPTool • Economia' });

    // Gráfico do índice de preço (só no avançado e com histórico suficiente).
    if (econ.advanced && econ.history.length >= 2) {
        const pts = econ.history.slice(-30);
        const labels = pts.map(h => new Date(h.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        const chart = await lineChart(labels, pts.map(h => Number(h.priceIndex.toFixed(3))));
        if (chart) {
            embed.setImage('attachment://economia.png');
            return message.reply({ embeds: [embed], files: [chart] });
        }
    }

    return message.reply({ embeds: [embed] });
}
