import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { GuildConfigModel } from '../models/GuildConfig'; 

export class LogMinister {
    static async getLogChannel(guildId: string, client: Client): Promise<TextChannel | null> {
        try {
            const config = await GuildConfigModel.findOne({ guildId });
            
            // 👇 SE NÃO EXISTIR, OU SE ESTIVER DESLIGADO, ELE ABORTA A MISSÃO!
            if (!config || !config.logChannelId || config.isLoggingEnabled === false) return null;
            
            const channel = client.channels.cache.get(config.logChannelId);
            return (channel?.isTextBased() ? channel : null) as TextChannel | null;
        } catch (error) {
            console.error("Erro ao buscar canal de logs no banco:", error);
            return null;
        }
    }

    static async publish(guildId: string, client: Client, embed: EmbedBuilder) {
        const channel = await this.getLogChannel(guildId, client);
        if (channel) {
            await channel.send({ embeds: [embed] }).catch(() => {});
        }
    }
}