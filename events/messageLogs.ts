import { Events, Message, PartialMessage, Client, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { LogMinister } from '../tools/utils/LogMinister';

export default [
    // 🔴 MENSAGEM DELETADA
    {
        name: Events.MessageDelete,
        once: false,
        execute: async (message: Message | PartialMessage, client: Client) => {
            if (!message.guild || message.author?.bot) return;
            if (!message.content && message.attachments.size === 0) return;

            let executor = "O próprio usuário ou um bot";

            try {
                const logs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
                const log = logs.entries.first();
                if (log && log.target.id === message.author?.id && Date.now() - log.createdTimestamp < 5000) {
                    executor = `${log.executor?.tag}`;
                }
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("🗑️ Mensagem Deletada")
                .setColor("Red")
                .setDescription(`**Autor:** ${message.author}\n**Canal:** ${message.channel}\n**Apagada por:** ${executor}`)
                .addFields({ name: "Conteúdo", value: message.content || "*Sem texto*" })
                .setTimestamp();

            if (message.attachments.size > 0) {
                const attachmentUrls = message.attachments.map(a => a.proxyURL).join("\n");
                embed.addFields({ name: "Anexos", value: attachmentUrls });
            }

            await LogMinister.publish(message.guild.id, client, embed);
        }
    },

    // 🟡 MENSAGEM EDITADA
    {
        name: Events.MessageUpdate,
        once: false,
        execute: async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage, client: Client) => {
            if (!newMessage.guild || newMessage.author?.bot) return;

            if (oldMessage.partial) await oldMessage.fetch().catch(() => {});
            if (newMessage.partial) await newMessage.fetch().catch(() => {});

            if (oldMessage.content === newMessage.content) return; // Ignora preview de link

            const embed = new EmbedBuilder()
                .setTitle("✏️ Mensagem Editada")
                .setColor("Yellow")
                .setDescription(`**Autor:** ${newMessage.author}\n**Canal:** ${newMessage.channel}\n[Ir para a mensagem](${newMessage.url})`)
                .addFields(
                    { name: "Antes", value: oldMessage.content || "*Vazio*" },
                    { name: "Depois", value: newMessage.content || "*Vazio*" }
                )
                .setTimestamp();

            await LogMinister.publish(newMessage.guild.id, client, embed);
        }
    }
];