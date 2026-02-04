import { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
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

    async execute(message: Message | any, args: string[]) {
        const guildId = message.guild.id;
        const filePath = path.join(__dirname, '../Data/statistics.json');

        if (!fs.existsSync(filePath)) {
            return message.reply("📉 Sem dados ainda. Conversem mais!");
        }

        const rawData = fs.readFileSync(filePath, 'utf-8');
        const globalStats = JSON.parse(rawData);
        const guildStats = globalStats[guildId]; 

        if (!guildStats) {
            return message.reply("📉 Sem dados para este servidor.");
        }

        // Prepara dados para o gráfico
        const daysEntries = Object.entries(guildStats.days);
        // Pega os últimos 7 dias
        const recentDays = daysEntries.slice(-7); 
        
        const labels = recentDays.map(([k]) => {
            const s = k.toString();
            return `${s.slice(0,2)}/${s.slice(2,4)}`;
        });
        const dataPoints = recentDays.map(([,v]) => v);

        // Gera gráfico via QuickChart
        const chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Mensagens',
                    data: dataPoints,
                    borderColor: 'rgb(75, 192, 192)',
                    fill: false,
                }]
            }
        };

        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;

        try {
            const response = await axios.get(chartUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');
            const attachment = new AttachmentBuilder(buffer, { name: 'graph.png' });

            const totalMsgs = Object.values(guildStats.users).reduce((a: any, b: any) => a + b, 0);

            const embed = new EmbedBuilder()
                .setColor(0x7289da)
                .setTitle(`📊 Status de ${message.guild.name}`)
                .addFields(
                    { name: '📈 Total Rastreado', value: `\`${totalMsgs}\` mensagens`, inline: false }
                )
                .setImage('attachment://graph.png');

            await message.reply({ embeds: [embed], files: [attachment] });

        } catch (e) {
            console.error("Erro ao gerar gráfico:", e);
            message.reply("📊 Estatísticas carregadas, mas o gráfico falhou.");
        }
    }
};