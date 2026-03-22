import { Events, GuildChannel, TextChannel, Client, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { LogMinister } from '../tools/utils/LogMinister';

export default [
    // 🟡 CANAL ATUALIZADO (Nome, Tópico, etc)
    {
        name: Events.ChannelUpdate,
        once: false,
        execute: async (oldChannel: GuildChannel, newChannel: GuildChannel, client: Client) => {
            if (!newChannel.guild) return;
            if (oldChannel.name === newChannel.name && (oldChannel as TextChannel).topic === (newChannel as TextChannel).topic) return;

            const embed = new EmbedBuilder()
                .setTitle("✏️ Canal Atualizado")
                .setColor("Yellow")
                .setDescription(`**Canal:** <#${newChannel.id}>`)
                .setTimestamp();

            if (oldChannel.name !== newChannel.name) {
                embed.addFields({ name: "Nome", value: `De: \`${oldChannel.name}\`\nPara: \`${newChannel.name}\`` });
            }

            await LogMinister.publish(newChannel.guild.id, client, embed);
        }
    },

    // 📌 MENSAGEM FIXADA/DESFIXADA
    {
        name: Events.ChannelPinsUpdate,
        once: false,
        execute: async (channel: TextChannel, time: Date, client: Client) => {
            if (!channel.guild) return;
            const embed = new EmbedBuilder()
                .setTitle("📌 Alteração de Mensagens Fixadas")
                .setColor("Blue")
                .setDescription(`O quadro de mensagens fixadas do canal <#${channel.id}> foi atualizado.`)
                .setTimestamp();

            await LogMinister.publish(channel.guild.id, client, embed);
        }
    },

    // 🪝 WEBHOOK ATUALIZADO
    {
        name: Events.WebhooksUpdate,
        once: false,
        execute: async (channel: TextChannel, client: Client) => {
            if (!channel.guild) return;
            const embed = new EmbedBuilder()
                .setTitle("🪝 Webhooks Atualizados")
                .setColor("Purple")
                .setDescription(`Houve uma alteração nos webhooks do canal <#${channel.id}> (Criado, Editado ou Deletado).`)
                .setTimestamp();

            await LogMinister.publish(channel.guild.id, client, embed);
        }
    }
];