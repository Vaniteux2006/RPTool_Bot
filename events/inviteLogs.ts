import { Events, Invite, Client, EmbedBuilder } from 'discord.js';
import { LogMinister } from '../tools/utils/LogMinister';

export default [
    // 🟢 CONVITE CRIADO
    {
        name: Events.InviteCreate,
        once: false,
        execute: async (invite: Invite, client: Client) => {
            if (!invite.guild) return;

            const embed = new EmbedBuilder()
                .setTitle("🔗 Novo Convite Criado")
                .setColor("Green")
                .setDescription(`**Criador:** ${invite.inviter ? `<@${invite.inviter.id}>` : "Desconhecido"}\n**Canal:** <#${invite.channelId}>\n**Código:** \`${invite.code}\`\n**Expira em:** ${invite.maxAge === 0 ? "Nunca" : `${invite.maxAge} segundos`}\n**Usos Máx:** ${invite.maxUses === 0 ? "Ilimitado" : invite.maxUses}`)
                .setTimestamp();

            await LogMinister.publish(invite.guild?.id, client, embed);
        }
    },

    // 🔴 CONVITE DELETADO
    {
        name: Events.InviteDelete,
        once: false,
        execute: async (invite: Invite, client: Client) => {
            if (!invite.guild) return;

            const embed = new EmbedBuilder()
                .setTitle("🗑️ Convite Deletado/Expirado")
                .setColor("Red")
                .setDescription(`**Canal:** <#${invite.channelId}>\n**Código:** \`${invite.code}\``)
                .setTimestamp();

            await LogMinister.publish(invite.guild?.id, client, embed);
        }
    }
];