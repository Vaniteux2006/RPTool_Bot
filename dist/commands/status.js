"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const axios_1 = __importDefault(require("axios"));
const ServerStats_1 = __importDefault(require("../models/ServerStats"));
const OCSchema_1 = require("../models/OCSchema");
exports.default = {
    name: 'status',
    description: 'Dashboard de estatísticas do servidor, usuários ou canais',
    aliases: ['stats', 'dashboard', 'rank'],
    data: new discord_js_1.SlashCommandBuilder()
        .setName('status')
        .setDescription('Mostra estatísticas completas do servidor')
        .addUserOption(option => option.setName('usuario').setDescription('Ver status de um usuário'))
        .addChannelOption(option => option.setName('canal').setDescription('Ver status de um canal'))
        .addStringOption(option => option.setName('oc').setDescription('Ver status de um OC (Nome)')),
    async executeSlash(interaction) {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('usuario');
        const targetChannel = interaction.options.getChannel('canal');
        const targetOC = interaction.options.getString('oc');
        let content = 'rp!status';
        if (targetUser)
            content += ` ${targetUser.id}`;
        else if (targetChannel)
            content += ` ${targetChannel.id}`;
        else if (targetOC)
            content += ` ${targetOC}`;
        const fakeMessage = {
            guild: interaction.guild,
            content: content,
            mentions: { users: { first: () => targetUser }, channels: { first: () => targetChannel } },
            reply: async (payload) => interaction.editReply(payload),
            client: interaction.client
        };
        await this.execute(fakeMessage);
    },
    async execute(message) {
        const guildId = message.guild.id;
        const args = message.content.trim().split(/ +/).slice(1);
        const targetArg = args.join(' ').toLowerCase();
        const now = new Date();
        const last15Days = Array.from({ length: 15 }, (_, i) => {
            const d = new Date(now);
            d.setUTCDate(d.getUTCDate() - i);
            return d.toISOString().split('T')[0];
        });
        const stats = await ServerStats_1.default.find({ guildId, date: { $in: last15Days } });
        if (!stats.length)
            return message.reply('📉 Ainda não coletei dados suficientes.');
        if (targetArg === 'rank user' || targetArg === 'rank users') {
            const userTotals = {};
            for (const stat of stats) {
                if (stat.users) {
                    for (const [uid, count] of stat.users.entries()) {
                        userTotals[uid] = (userTotals[uid] || 0) + count;
                    }
                }
            }
            const topUsersRaw = Object.entries(userTotals).sort(([, a], [, b]) => b - a).slice(0, 5);
            if (topUsersRaw.length === 0)
                return message.reply('📉 Nenhuma mensagem registrada ainda.');
            const chartLabels = [];
            const chartData = [];
            const embedFields = [];
            await Promise.all(topUsersRaw.map(async ([id, count], i) => {
                const position = ['1º', '2º', '3º', '4º', '5º'][i];
                let displayName = 'Desconhecido';
                let embedName = `<@${id}>`;
                if (/[a-zA-Z]/.test(id)) {
                    const oc = await OCSchema_1.OCModel.findById(id);
                    if (oc) {
                        displayName = oc.name;
                        embedName = `🎭 **${oc.name}**`;
                    }
                }
                else {
                    const u = await message.client.users.fetch(id).catch(() => null);
                    if (u)
                        displayName = u.username;
                }
                chartLabels.push(displayName.length > 12 ? displayName.substring(0, 10) + '...' : displayName);
                chartData.push(count);
                embedFields.push(`**${position}.** ${embedName}: \`${count.toLocaleString('pt-BR')} msgs\``);
            }));
            return await this.buildAndSendBarChart(message, `🏆 Ranking de Atividade: Top 5 Usuários`, chartLabels, chartData, [{ name: 'Os Mais Ativos (15 Dias)', value: embedFields.join('\n'), inline: false }]);
        }
        if (targetArg === 'rank channel' || targetArg === 'rank channels' || targetArg === 'rank chat') {
            const channelTotals = {};
            for (const stat of stats) {
                if (stat.channels) {
                    for (const [cid, count] of stat.channels.entries()) {
                        channelTotals[cid] = (channelTotals[cid] || 0) + count;
                    }
                }
            }
            const topChannelsRaw = Object.entries(channelTotals).sort(([, a], [, b]) => b - a).slice(0, 5);
            if (topChannelsRaw.length === 0)
                return message.reply('📉 Nenhuma mensagem registrada ainda.');
            const chartLabels = [];
            const chartData = [];
            const embedFields = [];
            topChannelsRaw.forEach(([id, count], i) => {
                const position = ['1º', '2º', '3º', '4º', '5º'][i];
                const ch = message.guild.channels.cache.get(id);
                const displayName = ch ? ch.name : 'Excluído';
                const embedName = `<#${id}>`;
                chartLabels.push(displayName.length > 12 ? displayName.substring(0, 10) + '...' : displayName);
                chartData.push(count);
                embedFields.push(`**${position}.** ${embedName}: \`${count.toLocaleString('pt-BR')} msgs\``);
            });
            return await this.buildAndSendBarChart(message, `📊 Ranking de Atividade: Top 5 Canais`, chartLabels, chartData, [{ name: 'Canais Mais Ativos (15 Dias)', value: embedFields.join('\n'), inline: false }]);
        }
        if (targetArg === 'rank words' || targetArg === 'rank word' || targetArg === 'rank palavras') {
            const wordTotals = {};
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
            if (topWordsRaw.length === 0)
                return message.reply('📉 Nenhuma palavra registrada ainda (ou o banco acabou de ser atualizado).');
            const embedFields = topWordsRaw.map(([word, count], i) => {
                const position = (i + 1).toString().padStart(2, '0');
                return `**${position}º** - \`${word}\`: ${count.toLocaleString('pt-BR')} vezes`;
            });
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle(`📝 Palavras Mais Usadas (Top 15)`)
                .setDescription(`As palavras mais frequentes dos últimos **15 dias** neste servidor.\n\n${embedFields.join('\n')}`)
                .setFooter({ text: 'RPTool | Ranking de Palavras', iconURL: message.guild.iconURL() });
            return await message.reply({ embeds: [embed] });
        }
        if (!targetArg) {
            let total15d = 0, total7d = 0, total24h = 0;
            const userTotals = {};
            const channelTotals = {};
            const dailyChartMap = {};
            for (const stat of stats) {
                total15d += stat.total;
                const statTime = new Date(`${stat.date}T${stat.hour.toString().padStart(2, '0')}:00:00Z`).getTime();
                const timeDiff = now.getTime() - statTime;
                if (timeDiff <= 7 * 24 * 60 * 60 * 1000)
                    total7d += stat.total;
                if (timeDiff <= 24 * 60 * 60 * 1000)
                    total24h += stat.total;
                dailyChartMap[stat.date] = (dailyChartMap[stat.date] || 0) + stat.total;
                if (stat.users) {
                    for (const [uid, count] of stat.users.entries())
                        userTotals[uid] = (userTotals[uid] || 0) + count;
                }
                if (stat.channels) {
                    for (const [cid, count] of stat.channels.entries())
                        channelTotals[cid] = (channelTotals[cid] || 0) + count;
                }
            }
            const topUsersRaw = Object.entries(userTotals).sort(([, a], [, b]) => b - a).slice(0, 5);
            const topUsersResolved = await Promise.all(topUsersRaw.map(async ([id, count], i) => {
                const position = ['1º', '2º', '3º', '4º', '5º'][i];
                if (/[a-zA-Z]/.test(id)) {
                    const oc = await OCSchema_1.OCModel.findById(id);
                    const name = oc ? `🎭 **${oc.name}**` : `ID Desconhecido`;
                    return `**${position}.** ${name}: \`${count.toLocaleString('pt-BR')} msgs\``;
                }
                return `**${position}.** <@${id}>: \`${count.toLocaleString('pt-BR')} msgs\``;
            }));
            const topChannels = Object.entries(channelTotals).sort(([, a], [, b]) => b - a).slice(0, 3);
            const topChannelsText = topChannels.map(([id, count], i) => `**${['1º', '2º', '3º'][i]}.** <#${id}>: \`${count.toLocaleString('pt-BR')} msgs\``).join('\n');
            const chartLabels = [];
            const dailyChartData = [];
            [...last15Days].reverse().forEach(day => {
                const dateObj = new Date(day);
                chartLabels.push(`${dateObj.getUTCDate()}/${dateObj.getUTCMonth() + 1}`);
                dailyChartData.push(dailyChartMap[day] || 0);
            });
            return await this.buildAndSend(message, `Estatísticas de ${message.guild.name}`, total15d, total7d, total24h, chartLabels, dailyChartData, null, [
                { name: 'Top 5 Ativos', value: topUsersResolved.join('\n'), inline: false },
                { name: 'Top 3 Canais', value: topChannelsText, inline: false }
            ]);
        }
        const originalArg = args.join(' ');
        let targetId = '', targetName = '', targetAvatar = null, targetType = 'oc';
        const mentionedUser = message.mentions?.users?.first();
        const mentionedChannel = message.mentions?.channels?.first();
        if (mentionedUser) {
            targetId = mentionedUser.id;
            targetName = mentionedUser.username;
            targetAvatar = mentionedUser.displayAvatarURL();
            targetType = 'user';
        }
        else if (mentionedChannel) {
            targetId = mentionedChannel.id;
            targetName = mentionedChannel.name;
            targetType = 'channel';
        }
        else {
            targetName = originalArg.replace(/^["']|["']$/g, '');
            const oc = await OCSchema_1.OCModel.findOne({ name: new RegExp(`^${targetName}$`, 'i') });
            if (oc) {
                targetId = oc._id.toString();
                targetName = oc.name;
                targetAvatar = oc.avatar;
                targetType = 'oc';
            }
            else if (originalArg.match(/^\d{17,19}$/)) {
                targetId = originalArg;
                targetType = 'user';
                const u = await message.client.users.fetch(originalArg).catch(() => null);
                if (u)
                    targetAvatar = u.displayAvatarURL();
            }
            else {
                return message.reply(`❌ Alvo **${targetName}** não encontrado.`);
            }
        }
        let total15d = 0, total7d = 0, total24h = 0;
        const dailyChartMap = {};
        for (const stat of stats) {
            let count = 0;
            if ((targetType === 'user' || targetType === 'oc') && stat.users)
                count = stat.users.get(targetId) || 0;
            if (targetType === 'channel' && stat.channels)
                count = stat.channels.get(targetId) || 0;
            if (count === 0)
                continue;
            total15d += count;
            const statTime = new Date(`${stat.date}T${stat.hour.toString().padStart(2, '0')}:00:00Z`).getTime();
            const timeDiff = now.getTime() - statTime;
            if (timeDiff <= 7 * 24 * 60 * 60 * 1000)
                total7d += count;
            if (timeDiff <= 24 * 60 * 60 * 1000)
                total24h += count;
            dailyChartMap[stat.date] = (dailyChartMap[stat.date] || 0) + count;
        }
        const chartLabels = [];
        const dailyChartData = [];
        [...last15Days].reverse().forEach(day => {
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
    async buildAndSendBarChart(message, title, labels, data, fields) {
        const chartConfig = {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                        data,
                        backgroundColor: 'rgba(88, 101, 242, 0.8)',
                        borderColor: 'rgba(88, 101, 242, 1)',
                        borderWidth: 1,
                        borderRadius: 4
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
                    y: { beginAtZero: true, ticks: { color: '#8e9297', font: { size: 10 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' }, suggestedMax: Math.max(...data) + 2 }
                }
            }
        };
        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&bkg=${encodeURIComponent('#2b2d31')}&w=600&h=300`;
        const response = await axios_1.default.get(chartUrl, { responseType: 'arraybuffer' });
        const attachment = new discord_js_1.AttachmentBuilder(Buffer.from(response.data), { name: 'rank.png' });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle(title)
            .setDescription(`Comparativo de atividade total dos últimos **15 dias**.`)
            .setImage('attachment://rank.png')
            .addFields(fields)
            .setFooter({ text: 'RPTool | Ranking', iconURL: message.guild.iconURL() });
        await message.reply({ embeds: [embed], files: [attachment] });
    },
    async buildAndSend(message, title, t15, t7, t24, labels, data, avatar, fields) {
        const chartConfig = {
            type: 'line',
            data: { labels, datasets: [{ data, borderColor: '#5865F2', backgroundColor: 'rgba(88, 101, 242, 0.15)', fill: true, cubicInterpolationMode: 'monotone', tension: 0.4, pointRadius: 0, borderWidth: 2 }] },
            options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8e9297', font: { size: 10 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: '#8e9297', font: { size: 10 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
        };
        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&bkg=${encodeURIComponent('#2b2d31')}&w=600&h=200`;
        const response = await axios_1.default.get(chartUrl, { responseType: 'arraybuffer' });
        const attachment = new discord_js_1.AttachmentBuilder(Buffer.from(response.data), { name: 'stats.png' });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x2b2d31).setTitle(title).setDescription(`Estatísticas dos últimos **15 dias**.`).setImage('attachment://stats.png')
            .addFields({ name: 'Mensagens', value: `15 Dias: \`${t15}\` | 7 Dias: \`${t7}\` | 24h: \`${t24}\`` }, ...fields)
            .setFooter({ text: 'RPTool | Status', iconURL: message.guild.iconURL() });
        if (avatar)
            embed.setThumbnail(avatar);
        await message.reply({ embeds: [embed], files: [attachment] });
    }
};
