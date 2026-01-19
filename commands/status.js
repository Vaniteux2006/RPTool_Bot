const { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = {
    name: 'status',
    description: 'Mostra o dashboard de estatísticas do servidor',
    aliases: ['stats', 'dashboard'],

    // --- MENU SLASH ---
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Mostra estatísticas do servidor'),

    // --- ADAPTADOR ---
    async executeSlash(interaction) {
        const fakeMessage = {
            guild: interaction.guild,
            reply: async (payload) => interaction.reply(payload)
        };
        await this.execute(fakeMessage, []);
    },

    // --- LÓGICA ORIGINAL ---
    async execute(message, args) {
        const guildId = message.guild.id;
        const filePath = path.join(__dirname, '..', 'Data', 'statistics.json');

        if (!fs.existsSync(filePath)) {
            return message.reply("📉 O banco de dados global ainda não foi criado. Falem algo no chat!");
        }

        const globalStats = JSON.parse(fs.readFileSync(filePath));
        const guildStats = globalStats[guildId]; 

        if (!guildStats) {
            return message.reply("📉 Ainda não tenho dados suficientes deste servidor específico!");
        }

        // PROCESSAR DADOS
        const daysArray = Object.entries(guildStats.days).map(([key, value]) => {
            const str = key.toString().padStart(8, '0');
            const day = str.substring(0, 2);
            const month = str.substring(2, 4);
            const year = str.substring(4, 8);
            return { label: `${day}/${month}`, dateObj: new Date(`${year}-${month}-${day}`), count: value };
        });
        
        daysArray.sort((a, b) => a.dateObj - b.dateObj);
        const recentDays = daysArray.slice(-10); 

        // QUICKCHART
        const chartConfig = {
            type: 'line',
            data: {
                labels: recentDays.map(d => d.label),
                datasets: [{
                    label: 'Mensagens',
                    data: recentDays.map(d => d.count),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4
                }]
            },
            options: {
                plugins: {
                    legend: { labels: { color: 'white', font: { size: 14 } } },
                    title: { display: true, text: `Atividade: ${message.guild.name}`, color: 'white', font: { size: 16 } }
                },
                scales: {
                    y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' }, beginAtZero: true },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                }
            }
        };

        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=800&height=400&backgroundColor=transparent`;

        try {
            const response = await axios.get(chartUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');
            const attachment = new AttachmentBuilder(buffer, { name: 'graph.png' });

            // TOPS
            const sortedUsers = Object.entries(guildStats.users).sort(([, a], [, b]) => b - a).slice(0, 5);
            const sortedChannels = Object.entries(guildStats.chats).sort(([, a], [, b]) => b - a).slice(0, 5);
            
            const userText = sortedUsers.map((e, i) => `**${i + 1}.** <@${e[0]}>: \`${e[1]}\``).join('\n') || "N/A";
            const channelText = sortedChannels.map((e, i) => `**${i + 1}.** #${e[0]}: \`${e[1]}\``).join('\n') || "N/A";
            const totalMsgs = Object.values(guildStats.users).reduce((a, b) => a + b, 0);

            const embed = new EmbedBuilder()
                .setColor(0x7289da)
                .setFooter({ text: `RPTool v1.2` })
                .setTitle(`📊 Status de ${message.guild.name}`)
                .addFields(
                    { name: '🏆 Top Usuários', value: userText, inline: true },
                    { name: '💬 Top Canais', value: channelText, inline: true },
                    { name: '📈 Total Rastreado', value: `\`${totalMsgs}\` mensagens`, inline: false }
                )
                .setImage('attachment://graph.png');
                

            await message.reply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error(error);
            message.reply("Deu ruim ao gerar o gráfico na API.");
        }
    }
};