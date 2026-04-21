import { Events, GuildEmoji, Client, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { LogMinister } from '../tools/utils/LogMinister';

export default [
    // 🟢 EMOJI CRIADO
    {
        name: Events.GuildEmojiCreate,
        once: false,
        execute: async (emoji: GuildEmoji, client: Client) => {
            let executor = "Desconhecido";
            try {
                const logs = await emoji.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiCreate });
                const log = logs.entries.first();
                if (log && log.target?.id === emoji.id) executor = `${log.executor?.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("😀 Emoji Adicionado")
                .setColor("Green")
                .setThumbnail(emoji.url)
                .setDescription(`**Nome:** :${emoji.name}:\n**ID:** ${emoji.id}\n**Adicionado por:** ${executor}`)
                .setTimestamp();
            
            await LogMinister.publish(emoji.guild.id, client, embed);
        }
    },

    // 🔴 EMOJI DELETADO
    {
        name: Events.GuildEmojiDelete,
        once: false,
        execute: async (emoji: GuildEmoji, client: Client) => {
            let executor = "Desconhecido";
            try {
                const logs = await emoji.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiDelete });
                const log = logs.entries.first();
                if (log && log.target?.id === emoji.id) executor = `${log.executor?.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("🗑️ Emoji Deletado")
                .setColor("Red")
                .setThumbnail(emoji.url)
                .setDescription(`**Nome:** :${emoji.name}:\n**Apagado por:** ${executor}`)
                .setTimestamp();
            
            await LogMinister.publish(emoji.guild.id, client, embed);
        }
    },

    // 🟡 EMOJI ATUALIZADO (Ex: Mudou o nome)
    {
        name: Events.GuildEmojiUpdate,
        once: false,
        execute: async (oldEmoji: GuildEmoji, newEmoji: GuildEmoji, client: Client) => {
            if (oldEmoji.name === newEmoji.name) return; // Só avisa se o nome mudar

            let executor = "Desconhecido";
            try {
                const logs = await newEmoji.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiUpdate });
                const log = logs.entries.first();
                if (log && log.target?.id === newEmoji.id) executor = `${log.executor?.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("✏️ Emoji Atualizado")
                .setColor("Yellow")
                .setThumbnail(newEmoji.url)
                .setDescription(`**De:** :${oldEmoji.name}:\n**Para:** :${newEmoji.name}:\n**Por:** ${executor}`)
                .setTimestamp();
            
            await LogMinister.publish(newEmoji.guild.id, client, embed);
        }
    }
];