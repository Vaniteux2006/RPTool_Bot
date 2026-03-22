import { Events, Sticker, Client, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { LogMinister } from '../tools/utils/LogMinister';

export default [
    // 🟢 STICKER CRIADO
    {
        name: Events.GuildStickerCreate,
        once: false,
        execute: async (sticker: Sticker, client: Client) => {
            if (!sticker.guild) return;
            let executor = "Desconhecido";
            try {
                const logs = await sticker.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.StickerCreate });
                const log = logs.entries.first();
                if (log && log.target?.id === sticker.id) executor = `${log.executor?.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("✨ Figurinha Criada")
                .setColor("Green")
                .setThumbnail(sticker.url)
                .setDescription(`**Nome:** ${sticker.name}\n**Criada por:** ${executor}`)
                .setTimestamp();
            
            await LogMinister.publish(sticker.guild.id, client, embed);
        }
    },

    // 🔴 STICKER DELETADO
    {
        name: Events.GuildStickerDelete,
        once: false,
        execute: async (sticker: Sticker, client: Client) => {
            if (!sticker.guild) return;
            let executor = "Desconhecido";
            try {
                const logs = await sticker.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.StickerDelete });
                const log = logs.entries.first();
                if (log && log.target?.id === sticker.id) executor = `${log.executor?.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("🗑️ Figurinha Deletada")
                .setColor("Red")
                .setThumbnail(sticker.url)
                .setDescription(`**Nome:** ${sticker.name}\n**Apagada por:** ${executor}`)
                .setTimestamp();
            
            await LogMinister.publish(sticker.guild.id, client, embed);
        }
    },

    // 🟡 STICKER ATUALIZADO
    {
        name: Events.GuildStickerUpdate,
        once: false,
        execute: async (oldSticker: Sticker, newSticker: Sticker, client: Client) => {
            if (!newSticker.guild) return;
            if (oldSticker.name === newSticker.name && oldSticker.description === newSticker.description) return;

            let executor = "Desconhecido";
            try {
                const logs = await newSticker.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.StickerUpdate });
                const log = logs.entries.first();
                if (log && log.target?.id === newSticker.id) executor = `${log.executor?.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("✏️ Figurinha Atualizada")
                .setColor("Yellow")
                .setThumbnail(newSticker.url)
                .setDescription(`**Nome Antigo:** ${oldSticker.name}\n**Nome Novo:** ${newSticker.name}\n**Por:** ${executor}`)
                .setTimestamp();
            
            await LogMinister.publish(newSticker.guild.id, client, embed);
        }
    }
];