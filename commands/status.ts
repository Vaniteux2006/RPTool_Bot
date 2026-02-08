import {
    AttachmentBuilder,
    EmbedBuilder,
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Message
} from 'discord.js';

import fs from 'fs';
import path from 'path';
import axios from 'axios';

export default {
    name: 'status',
    description: 'Dashboard de estatísticas',
    aliases: ['stats', 'dashboard'],

    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Mostra estatísticas do servidor'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const fakeMessage: any = {
            guild: interaction.guild,
            reply: async (payload: any) => interaction.reply(payload)
        };
        await this.execute(fakeMessage, []);
    },

    async execute(message: Message | any) {
        const guildId = message.guild.id;
        const filePath = path.join(__dirname, '../Data/statistics.json');

        if (!fs.existsSync(filePath)) {
            return message.reply('📉 Sem dados ainda.');
        }

        const rawData = fs.readFileSync(filePath, 'utf-8');
        const globalStats = JSON.parse(rawData);
        const guildStats = globalStats[guildId];

        if (!guildStats) {
            return message.reply('📉 Sem dados para este servidor.');
        }

        /* =============================
           📊 DADOS DAS ÚLTIMAS 24 HORAS
        ============================== */

        const hours = guildStats.hours || {};
        const hourLabels = Object.keys(hours).sort((a, b) => Number(a) - Number(b));
        const hourData = hourLabels.map(h => hours[h]);

        const total24h = hourData.reduce((a, b) => a + b, 0);

        const peakHour = hourLabels.reduce((max, h) =>
            hours[h] > (hours[max] ?? 0) ? h : max
        , hourLabels[0]);

        const peakText = `${peakHour}:00 até ${String(Number(peakHour) + 1).padStart(2, '0')}:00`;

        /* =============================
           🏆 TOP 5 USUÁRIOS
        ============================== */

        const topUsers = Object.entries(guildStats.users || {})
            .sort((a: any, b: any) => b[1] - a[1])
            .slice(0, 5);

        const topUsersText = topUsers.length
            ? await Promise.all(
                topUsers.map(async ([id, count]: any, i) => {
                    const user = await message.guild.members.fetch(id).catch(() => null);
                    const name = user ? user.user.username : `ID ${id}`;
                    return `**${i + 1}º** - ${name} → \`${count}\``;
                })
            ).then(r => r.join('\n'))
            : 'Sem dados suficientes';

        /* =============================
           📈 GRÁFICO (LINE SMOOTH)
        ============================== */

        const chartConfig = {
            type: 'line',
            data: {
                labels: hourLabels.map(h => `${h}:00`),
                datasets: [{
                    label: 'Mensagens',
                    data: hourData,
                    borderColor: 'rgb(88, 101, 242)',
                    backgroundColor: 'rgba(88, 101, 242, 0.2)',
                    fill: true,
                    tension: 0.45, // 🔥 suavidade estilo Statbot
                    pointRadius: 3
                }]
            },
            options: {
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        };

        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;

        try {
            const response = await axios.get(chartUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data);
            const attachment = new AttachmentBuilder(buffer, { name: 'status.png' });

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`📊 Estatísticas - ${message.guild.name}`)
                .addFields(
                    {
                        name: '📨 Total (últimas 24h)',
                        value: `\`${total24h}\` mensagens`,
                        inline: false
                    },
                    {
                        name: '🔥 Horário de Pico',
                        value: peakText,
                        inline: false
                    },
                    {
                        name: '🏆 Top Usuários',
                        value: topUsersText,
                        inline: false
                    }
                )
                .setImage('attachment://status.png')
                .setFooter({ text: 'Atualizado automaticamente' });

            await message.reply({
                embeds: [embed],
                files: [attachment]
            });

        } catch (err) {
            console.error(err);
            message.reply('❌ Erro ao gerar gráfico.');
        }
    }
};
