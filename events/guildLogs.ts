import { Events, GuildBan, GuildMember, PartialGuildMember, Client, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { LogMinister } from '../tools/utils/LogMinister';

export default [
    // 🔨 MEMBRO BANIDO
    {
        name: Events.GuildBanAdd,
        once: false,
        execute: async (ban: GuildBan, client: Client) => {
            let executor = "Desconhecido";
            let reason = ban.reason || "Nenhum motivo fornecido";

            try {
                const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
                const log = logs.entries.first();
                if (log && log.target?.id === ban.user.id) {
                    executor = `${log.executor?.tag}`;
                    if (log.reason) reason = log.reason;
                }
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("🔨 Membro Banido")
                .setColor("DarkRed")
                .setThumbnail(ban.user.displayAvatarURL())
                .setDescription(`**Usuário:** ${ban.user.tag} (<@${ban.user.id}>)\n**Banido por:** ${executor}\n**Motivo:** ${reason}`)
                .setTimestamp();

            await LogMinister.publish(ban.guild.id, client, embed);
        }
    },

    // 🕊️ BANIMENTO REVOGADO (UNBAN)
    {
        name: Events.GuildBanRemove,
        once: false,
        execute: async (ban: GuildBan, client: Client) => {
            let executor = "Desconhecido";
            try {
                const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
                const log = logs.entries.first();
                if (log && log.target?.id === ban.user.id) executor = `${log.executor?.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("🕊️ Banimento Revogado")
                .setColor("Green")
                .setThumbnail(ban.user.displayAvatarURL())
                .setDescription(`**Usuário:** ${ban.user.tag} (<@${ban.user.id}>)\n**Desbanido por:** ${executor}`)
                .setTimestamp();

            await LogMinister.publish(ban.guild.id, client, embed);
        }
    },

    // 🔵 ATUALIZAÇÃO DE MEMBRO (NICKNAME E CARGOS)
    {
        name: Events.GuildMemberUpdate,
        once: false,
        execute: async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember, client: Client) => {
            const guildId = newMember.guild.id;

            // Nickname
            if (oldMember.nickname !== newMember.nickname) {
                const embed = new EmbedBuilder()
                    .setTitle("🏷️ Apelido Alterado")
                    .setColor("Blue")
                    .setDescription(`**Membro:** ${newMember.user}`)
                    .addFields(
                        { name: "Antigo", value: oldMember.nickname || oldMember.user.username, inline: true },
                        { name: "Novo", value: newMember.nickname || newMember.user.username, inline: true }
                    )
                    .setTimestamp();
                await LogMinister.publish(guildId, client, embed);
            }

            // Cargos
            if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
                const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
                const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

                let executor = "Desconhecido";
                try {
                    const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
                    const log = logs.entries.first();
                    if (log && log.target?.id === newMember.id && Date.now() - log.createdTimestamp < 5000) {
                        executor = `${log.executor?.tag}`;
                    }
                } catch (e) {}

                if (addedRoles.size > 0) {
                    const embed = new EmbedBuilder()
                        .setTitle("🛡️ Cargo Adicionado")
                        .setColor("Green")
                        .setDescription(`**Membro:** ${newMember.user}\n**Cargo(s):** ${addedRoles.map(r => r).join(", ")}\n**Por:** ${executor}`);
                    await LogMinister.publish(guildId, client, embed);
                }

                if (removedRoles.size > 0) {
                    const embed = new EmbedBuilder()
                        .setTitle("🛡️ Cargo Removido")
                        .setColor("Red")
                        .setDescription(`**Membro:** ${newMember.user}\n**Cargo(s):** ${removedRoles.map(r => r).join(", ")}\n**Por:** ${executor}`);
                    await LogMinister.publish(guildId, client, embed);
                }
            }
        }
    }
];