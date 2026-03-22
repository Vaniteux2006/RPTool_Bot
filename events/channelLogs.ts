import { Events, GuildChannel, Client, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { LogMinister } from '../tools/utils/LogMinister';

export default [
    // 🟢 CANAL CRIADO
    {
        name: Events.ChannelCreate,
        once: false,
        execute: async (channel: GuildChannel, client: Client) => {
            if (!channel.guild) return;
            let executor = "Desconhecido";

            try {
                const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
                const log = logs.entries.first();
                if (log && log.target.id === channel.id && Date.now() - log.createdTimestamp < 5000) {
                    executor = `${log.executor?.tag}`;
                }
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("📁 Canal Criado")
                .setColor("Green")
                .setDescription(`**Nome:** ${channel.name} (<#${channel.id}>)\n**Criado por:** ${executor}`)
                .setTimestamp();

            await LogMinister.publish(channel.guild.id, client, embed);
        }
    },

    // 🔴 CANAL DELETADO
    {
        name: Events.ChannelDelete,
        once: false,
        execute: async (channel: GuildChannel, client: Client) => {
            if (!channel.guild) return;
            let executor = "Desconhecido";

            try {
                const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
                const log = logs.entries.first();
                if (log && log.target.id === channel.id && Date.now() - log.createdTimestamp < 5000) {
                    executor = `${log.executor?.tag}`;
                }
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("🗑️ Canal Deletado")
                .setColor("Red")
                .setDescription(`**Nome do Canal:** #${channel.name}\n**Apagado por:** ${executor}`)
                .setTimestamp();

            await LogMinister.publish(channel.guild.id, client, embed);
        }
    }
];