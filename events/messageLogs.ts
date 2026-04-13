import { Events, Message, PartialMessage, Client, AuditLogEvent, EmbedBuilder, AttachmentBuilder } from 'discord.js';
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
    async execute(oldMessage: Message, newMessage: Message, client: Client) {
        // Ignora bots e mensagens que não foram carregadas corretamente
        if (oldMessage.author?.bot || !oldMessage.guild) return;
        if (oldMessage.content === newMessage.content) return;

        const files: AttachmentBuilder[] = [];

        // Função mágica que decide se vai pro Embed ou vira .txt
        const processContent = (content: string, fileName: string) => {
            if (!content || content.trim() === "") return "*Mensagem vazia/Apenas mídia*";
            
            if (content.length > 1000) {
                const buffer = Buffer.from(content, 'utf-8');
                files.push(new AttachmentBuilder(buffer, { name: fileName }));
                return `⚠️ **Texto muito longo!** O conteúdo foi anexado no arquivo \`${fileName}\` acima.`;
            }
            return content;
        };

        const oldContent = processContent(oldMessage.content || "", "mensagem_antiga.txt");
        const newContent = processContent(newMessage.content || "", "mensagem_nova.txt");

        const embed = new EmbedBuilder()
            .setTitle("📝 Mensagem Editada")
            .setColor("Yellow")
            .setAuthor({ 
                name: newMessage.author.tag, 
                iconURL: newMessage.author.displayAvatarURL() 
            })
            .setDescription(`**Canal:** <#${newMessage.channelId}> [Ir para a mensagem](${newMessage.url})`)
            .addFields(
                { name: "Antes", value: oldContent },
                { name: "Depois", value: newContent }
            )
            .setFooter({ text: `ID do Usuário: ${newMessage.author.id}` })
            .setTimestamp();

        await LogMinister.publish(newMessage.guild.id, client, embed, files);
    }
    }
];