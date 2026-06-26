// RPTool/supercommands/status/index.ts
// ─── Dashboard de Estatísticas ────────────────────────────────────────────────
//
// Arquitetura (padrão dos supercommands):
//   index.ts                 → roteador: overview, rankings top-5, status por alvo, gráficos
//   interactions.ts          → botões de ranking paginado (◀ ▶) + modal "Ranking do Dia"
//   handlers/backfill.ts     → rp!status docpast: varre o histórico e popula o passado
//
// Coleta: tools/command_checkout.ts grava os buckets (guildId, date, hour) com
//   users / channels / ocs / words. Aqui só lemos e renderizamos.
//
// Navegação:
//   rp!status                 → visão geral (14 dias) + botões de ranking
//   rp!status <@user|#canal|"OC"> → atividade de um alvo específico
//   rp!status rank user|channel|words → rankings top-5/top-15 em gráfico
//   rp!status docpast [DD/MM/AAAA]    → backfill do passado (admin)
import {
    AttachmentBuilder,
    EmbedBuilder,
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Message,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import axios from 'axios';
import ServerStats from '../../tools/models/ServerStats';
import { OCModel } from '../../tools/models/OCSchema';
import { handleDocpast } from './handlers/backfill';
import { handleHeatmap } from './handlers/heatmap';
import { handleHistorico } from './handlers/historico';
import { handleProfile } from './handlers/profile';
import { handleWrapped } from './handlers/wrapped';
import { handleExplore } from './handlers/explore';
import { handleTrending } from './handlers/trending';

// Janela de coleta (em dias) — espelha o "lookback" do Statbot.
// Trocar aqui ajusta TODOS os textos e gráficos do comando de uma vez.
export const LOOKBACK_DAYS = 14;

export default {
    name: 'status',
    description: 'Dashboard de estatísticas do servidor, usuários ou canais',
    aliases: ['stats', 'dashboard', 'rank'],

    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Mostra estatísticas completas do servidor')
        .addUserOption(option => option.setName('usuario').setDescription('Ver status de um usuário'))
        .addChannelOption(option => option.setName('canal').setDescription('Ver status de um canal'))
        .addStringOption(option => option.setName('oc').setDescription('Ver status de um OC (Nome)')),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('usuario');
        const targetChannel = interaction.options.getChannel('canal');
        const targetOC = interaction.options.getString('oc');

        let content = 'rp!status';
        if (targetUser) content += ` ${targetUser.id}`;
        else if (targetChannel) content += ` ${targetChannel.id}`;
        else if (targetOC) content += ` ${targetOC}`;

        const fakeMessage: any = {
            guild: interaction.guild,
            content: content,
            author: { id: interaction.user.id },
            mentions: { users: { first: () => targetUser }, channels: { first: () => targetChannel } },
            reply: async (payload: any) => interaction.editReply(payload),
            client: interaction.client
        };
        await this.execute(fakeMessage);
    },

    async execute(message: Message | any) {
        const guildId = message.guild.id;
        const args = message.content.trim().split(/ +/).slice(1);
        const targetArg = args.join(' ').toLowerCase();

        // ── Backfill do passado (admin): rp!status docpast [DD/MM/AAAA] ──
        if (args[0]?.toLowerCase() === 'docpast') {
            return handleDocpast(message, args);
        }

        // ── Suíte de estatística histórica ──
        switch (args[0]?.toLowerCase()) {
            case 'heatmap': case 'mapa': case 'calor':
                return handleHeatmap(message, args);
            case 'historico': case 'histórico': case 'timeline': case 'linha':
                return handleHistorico(message, args);
            case 'perfil': case 'profile':
                return handleProfile(message, args);
            case 'wrapped': case 'retrospectiva': case 'recap':
                return handleWrapped(message, args);
            case 'explorar': case 'explore': case 'query': case 'ver':
                return handleExplore(message, args);
            case 'trending': case 'alta': case 'hot': case 'tendencias': case 'tendências': case 'tendencia': case 'tendência':
                return handleTrending(message, args);
            case 'help': case 'ajuda': case 'comandos': case 'cmds':
                return message.reply(
                    `📊 **Comandos do Status**\n` +
                    `\`rp!status\` — visão geral (14 dias) com botões\n` +
                    `\`rp!status @user | #canal | "OC"\` — atividade de um alvo\n` +
                    `\`rp!status explorar\` — explorador: período × dimensão, Ngram, alvo\n` +
                    `\`rp!status trending [dia|semana|mes] [DD/MM/AAAA]\` — em alta + momentos quentes (viaja no tempo)\n` +
                    `\`rp!status heatmap [@user]\` — mapa de calor dia × hora\n` +
                    `\`rp!status historico [@user]\` — linha do tempo mensal\n` +
                    `\`rp!status perfil @user\` — perfil temporal\n` +
                    `\`rp!status wrapped [ano] [@user]\` — retrospectiva\n` +
                    `\`rp!status rank user|channel|words\` — rankings em gráfico\n` +
                    `\`rp!status docpast [DD/MM/AAAA | reset]\` — varre o histórico (admin)`,
                );
        }

        const now = new Date();
        const lookbackDays = Array.from({ length: LOOKBACK_DAYS }, (_, i) => {
            const d = new Date(now);
            d.setUTCDate(d.getUTCDate() - i);
            return d.toISOString().split('T')[0];
        });

        const stats = await ServerStats.find({ guildId, date: { $in: lookbackDays } });
        if (!stats.length) return message.reply('📉 Ainda não coletei dados suficientes.');

        if (targetArg === 'rank user' || targetArg === 'rank users') {
            const userTotals: Record<string, number> = {};

            for (const stat of stats) {
                if (stat.users) {
                    for (const [uid, count] of stat.users.entries()) {
                        userTotals[uid] = (userTotals[uid] || 0) + count;
                    }
                }
            }

            const topUsersRaw = Object.entries(userTotals).sort(([, a], [, b]) => b - a).slice(0, 5);
            if (topUsersRaw.length === 0) return message.reply('📉 Nenhuma mensagem registrada ainda.');

            const chartLabels: string[] = [];
            const chartData: number[] = [];
            const embedFields: string[] = [];

            await Promise.all(topUsersRaw.map(async ([id, count], i) => {
                const position = ['1º', '2º', '3º', '4º', '5º'][i];
                let displayName = 'Desconhecido';
                let embedName = `<@${id}>`;

                if (/[a-zA-Z]/.test(id)) {
                    const oc = await OCModel.findById(id);
                    if (oc) {
                        displayName = oc.name;
                        embedName = `🎭 **${oc.name}**`;
                    }
                } else {
                    const u = await message.client.users.fetch(id).catch(() => null);
                    if (u) displayName = u.username;
                }

                chartLabels.push(displayName.length > 12 ? displayName.substring(0, 10) + '...' : displayName);
                chartData.push(count);
                embedFields.push(`**${position}.** ${embedName}: \`${count.toLocaleString('pt-BR')} msgs\``);
            }));

            return await this.buildAndSendBarChart(
                message,
                `🏆 Ranking de Atividade: Top 5 Usuários`,
                chartLabels,
                chartData,
                [{ name: `Os Mais Ativos (${LOOKBACK_DAYS} Dias)`, value: embedFields.join('\n'), inline: false }]
            );
        }

        if (targetArg === 'rank channel' || targetArg === 'rank channels' || targetArg === 'rank chat') {
            const channelTotals: Record<string, number> = {};

            for (const stat of stats) {
                if (stat.channels) {
                    for (const [cid, count] of stat.channels.entries()) {
                        channelTotals[cid] = (channelTotals[cid] || 0) + count;
                    }
                }
            }

            const topChannelsRaw = Object.entries(channelTotals).sort(([, a], [, b]) => b - a).slice(0, 5);
            if (topChannelsRaw.length === 0) return message.reply('📉 Nenhuma mensagem registrada ainda.');

            const chartLabels: string[] = [];
            const chartData: number[] = [];
            const embedFields: string[] = [];

            topChannelsRaw.forEach(([id, count], i) => {
                const position = ['1º', '2º', '3º', '4º', '5º'][i];
                const ch = message.guild.channels.cache.get(id);
                const displayName = ch ? ch.name : 'Excluído';
                const embedName = `<#${id}>`;

                chartLabels.push(displayName.length > 12 ? displayName.substring(0, 10) + '...' : displayName);
                chartData.push(count);
                embedFields.push(`**${position}.** ${embedName}: \`${count.toLocaleString('pt-BR')} msgs\``);
            });

            return await this.buildAndSendBarChart(
                message,
                `📊 Ranking de Atividade: Top 5 Canais`,
                chartLabels,
                chartData,
                [{ name: `Canais Mais Ativos (${LOOKBACK_DAYS} Dias)`, value: embedFields.join('\n'), inline: false }]
            );
        }

        if (targetArg === 'rank words' || targetArg === 'rank word' || targetArg === 'rank palavras') {
            const wordTotals: Record<string, number> = {};

            for (const stat of stats) {
                if (stat.words) {
                    for (const [word, count] of stat.words.entries()) {
                        wordTotals[word] = (wordTotals[word] || 0) + count;
                    }
                }
            }

            const topWordsRaw = Object.entries(wordTotals)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 15);

            if (topWordsRaw.length === 0) return message.reply('📉 Nenhuma palavra registrada ainda (ou o banco acabou de ser atualizado).');

            const embedFields = topWordsRaw.map(([word, count], i) => {
                const position = (i + 1).toString().padStart(2, '0');
                return `**${position}º** - \`${word}\`: ${count.toLocaleString('pt-BR')} vezes`;
            });

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle(`📝 Palavras Mais Usadas (Top 15)`)
                .setDescription(`As palavras mais frequentes dos últimos **${LOOKBACK_DAYS} dias** neste servidor.\n\n${embedFields.join('\n')}`)
                .setFooter({ text: 'RPTool | Ranking de Palavras', iconURL: message.guild.iconURL() });

            return await message.reply({ embeds: [embed] });
        }


        if (!targetArg) {
            let total15d = 0, total7d = 0, total24h = 0;
            const userTotals: Record<string, number> = {};
            const channelTotals: Record<string, number> = {};
            const dailyChartMap: Record<string, number> = {};

            for (const stat of stats) {
                total15d += stat.total;
                const statTime = new Date(`${stat.date}T${stat.hour.toString().padStart(2, '0')}:00:00Z`).getTime();
                const timeDiff = now.getTime() - statTime;

                if (timeDiff <= 7 * 24 * 60 * 60 * 1000) total7d += stat.total;
                if (timeDiff <= 24 * 60 * 60 * 1000) total24h += stat.total;
                dailyChartMap[stat.date] = (dailyChartMap[stat.date] || 0) + stat.total;

                if (stat.users) {
                    for (const [uid, count] of stat.users.entries()) userTotals[uid] = (userTotals[uid] || 0) + count;
                }
                if (stat.channels) {
                    for (const [cid, count] of stat.channels.entries()) channelTotals[cid] = (channelTotals[cid] || 0) + count;
                }
            }

            const topUsersRaw = Object.entries(userTotals).sort(([, a], [, b]) => b - a).slice(0, 5);
            const topUsersResolved = await Promise.all(topUsersRaw.map(async ([id, count], i) => {
                const position = ['1º', '2º', '3º', '4º', '5º'][i];
                if (/[a-zA-Z]/.test(id)) {
                    const oc = await OCModel.findById(id);
                    const name = oc ? `🎭 **${oc.name}**` : `ID Desconhecido`;
                    return `**${position}.** ${name}: \`${count.toLocaleString('pt-BR')} msgs\``;
                }
                return `**${position}.** <@${id}>: \`${count.toLocaleString('pt-BR')} msgs\``;
            }));

            const topChannels = Object.entries(channelTotals).sort(([, a], [, b]) => b - a).slice(0, 3);
            const topChannelsText = topChannels.map(([id, count], i) => `**${['1º', '2º', '3º'][i]}.** <#${id}>: \`${count.toLocaleString('pt-BR')} msgs\``).join('\n');

            const chartLabels: string[] = [];
            const dailyChartData: number[] = [];
            [...lookbackDays].reverse().forEach(day => {
                const dateObj = new Date(day);
                chartLabels.push(`${dateObj.getUTCDate()}/${dateObj.getUTCMonth() + 1}`);
                dailyChartData.push(dailyChartMap[day] || 0);
            });

            const invokerId = message.author?.id ?? '0';
            const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`stats_users:1:${invokerId}`).setLabel('Ranking Users').setEmoji('👥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`stats_chats:1:${invokerId}`).setLabel('Ranking Chats').setEmoji('💬').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`stats_ocs:1:${invokerId}`).setLabel('Ranking OCs').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`stats_day:${invokerId}`).setLabel('Ranking do Dia').setEmoji('📅').setStyle(ButtonStyle.Secondary),
            );
            const toolRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`stats_exp:all:all:timeline:_:${invokerId}`).setLabel('Explorar').setEmoji('🔎').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`stats_trend:7d:now:${invokerId}`).setLabel('Em Alta').setEmoji('🔥').setStyle(ButtonStyle.Primary),
            );

            return await this.buildAndSend(message, `📊 ${message.guild.name} — Visão Geral de Mensagens`, total15d, total7d, total24h, chartLabels, dailyChartData, null, [
                { name: '👥 Top 5 Usuários', value: topUsersResolved.join('\n'), inline: false },
                { name: '💬 Top 3 Canais', value: topChannelsText, inline: false }
            ], [navRow, toolRow]);
        }

        const originalArg = args.join(' ');
        let targetId = '', targetName = '', targetAvatar: string | null = null, targetType: 'user' | 'channel' | 'oc' = 'oc';

        const mentionedUser = message.mentions?.users?.first();
        const mentionedChannel = message.mentions?.channels?.first();

        if (mentionedUser) {
            targetId = mentionedUser.id; targetName = mentionedUser.username; targetAvatar = mentionedUser.displayAvatarURL(); targetType = 'user';
        } else if (mentionedChannel) {
            targetId = mentionedChannel.id; targetName = mentionedChannel.name; targetType = 'channel';
        } else {
            targetName = originalArg.replace(/^["']|["']$/g, '');
            const oc = await OCModel.findOne({ name: new RegExp(`^${targetName}$`, 'i') });
            if (oc) {
                targetId = oc._id.toString(); targetName = oc.name; targetAvatar = oc.avatar; targetType = 'oc';
            } else if (originalArg.match(/^\d{17,19}$/)) {
                targetId = originalArg; targetType = 'user';
                const u = await message.client.users.fetch(originalArg).catch(() => null);
                if (u) targetAvatar = u.displayAvatarURL();
            } else {
                return message.reply(`❌ Alvo **${targetName}** não encontrado. (Use \`rp!status help\` para ver os comandos.)`);
            }
        }

        let total15d = 0, total7d = 0, total24h = 0;
        const dailyChartMap: Record<string, number> = {};

        for (const stat of stats) {
            let count = 0;
            if ((targetType === 'user' || targetType === 'oc') && stat.users) count = stat.users.get(targetId) || 0;
            if (targetType === 'channel' && stat.channels) count = stat.channels.get(targetId) || 0;
            if (count === 0) continue;

            total15d += count;
            const statTime = new Date(`${stat.date}T${stat.hour.toString().padStart(2, '0')}:00:00Z`).getTime();
            const timeDiff = now.getTime() - statTime;
            if (timeDiff <= 7 * 24 * 60 * 60 * 1000) total7d += count;
            if (timeDiff <= 24 * 60 * 60 * 1000) total24h += count;
            dailyChartMap[stat.date] = (dailyChartMap[stat.date] || 0) + count;
        }

        const chartLabels: string[] = [];
        const dailyChartData: number[] = [];
        [...lookbackDays].reverse().forEach(day => {
            const dateObj = new Date(day);
            chartLabels.push(`${dateObj.getUTCDate()}/${dateObj.getUTCMonth() + 1}`);
            dailyChartData.push(dailyChartMap[day] || 0);
        });

        const title = targetType === 'oc' ? `Atividade do OC "${targetName}"` : `Atividade do ${targetType === 'user' ? 'Usuário' : 'Canal'}`;
        const alvoDisplay = targetType === 'oc' ? `🎭 **${targetName}**` : (targetType === 'user' ? `<@${targetId}>` : `<#${targetId}>`);

        await this.buildAndSend(message, title, total15d, total7d, total24h, chartLabels, dailyChartData, targetAvatar, [
            { name: 'Alvo Principal', value: alvoDisplay, inline: false }
        ]);
    },

    async buildAndSendBarChart(message: any, title: string, labels: string[], data: number[], fields: any[]) {
        const chartConfig = {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: 'rgba(88, 101, 242, 0.8)',
                    borderColor: 'rgba(88, 101, 242, 1)',
                    lineTension: 0.4,
                    borderWidth: 1,
                    borderRadius: 4,
                    pointRadius: 0,
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        display: true,
                        align: 'end',
                        anchor: 'end',
                        color: '#fff',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                scales: {
                    x: { ticks: { color: '#8e9297', font: { size: 11 } }, grid: { display: false } },
                    y: { beginAtZero: true, ticks: { color: '#8e9297', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, suggestedMax: Math.ceil(Math.max(...data) * 1.15) }
                }
            }
        };

        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&bkg=${encodeURIComponent('#2b2d31')}&w=600&h=300`;
        const response = await axios.get(chartUrl, { responseType: 'arraybuffer' });
        const attachment = new AttachmentBuilder(Buffer.from(response.data), { name: 'rank.png' });

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle(title)
            .setDescription(`Comparativo de atividade total dos últimos **${LOOKBACK_DAYS} dias**.`)
            .setImage('attachment://rank.png')
            .addFields(fields)
            .setFooter({ text: 'RPTool | Ranking', iconURL: message.guild.iconURL() });

        await message.reply({ embeds: [embed], files: [attachment] });
    },

    async buildAndSend(message: any, title: string, t15: number, t7: number, t24: number, labels: string[], data: number[], avatar: string | null, fields: any[], components: any[] = []) {
        const chartConfig = {
            type: 'line',
            data: { labels, datasets: [{ data, borderColor: '#5865F2', backgroundColor: 'rgba(88, 101, 242, 0.15)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }] },
            // stepSize removido: deixa o Chart.js escolher a escala (1k, 2k…) — essencial em servidores grandes
            options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8e9297', font: { size: 10 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: '#8e9297', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
        };

        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&bkg=${encodeURIComponent('#2b2d31')}&w=600&h=200&v=3`;
        const response = await axios.get(chartUrl, { responseType: 'arraybuffer' });
        const attachment = new AttachmentBuilder(Buffer.from(response.data), { name: 'stats.png' });

        const fmt = (n: number) => n.toLocaleString('pt-BR');
        const somaMensagens =
            `**${LOOKBACK_DAYS} Dias:** \`${fmt(t15)}\` mensagens\n` +
            `**7 Dias:** \`${fmt(t7)}\` mensagens\n` +
            `**24 Horas:** \`${fmt(t24)}\` mensagens`;

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle(title)
            .setDescription(`Estatísticas de mensagens dos últimos **${LOOKBACK_DAYS} dias**.\n*Todos os horários são exibidos no fuso UTC (GMT±0).*`)
            .setImage('attachment://stats.png')
            .addFields({ name: '🧮 Soma de Mensagens', value: somaMensagens, inline: false }, ...fields)
            .setFooter({ text: 'RPTool | Status', iconURL: message.guild.iconURL() })
            .setTimestamp();

        if (avatar) embed.setThumbnail(avatar);
        await message.reply({ embeds: [embed], files: [attachment], components });
    }
};
