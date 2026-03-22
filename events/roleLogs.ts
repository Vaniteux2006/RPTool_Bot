import { Events, Role, Client, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { LogMinister } from '../tools/utils/LogMinister';

export default [
    // 🟢 EVENTO 1: CARGO CRIADO
    {
        name: Events.GuildRoleCreate,
        once: false,
        execute: async (role: Role, client: Client) => {
            let executor = "Desconhecido";
            try {
                const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
                const log = logs.entries.first();
                if (log && log.target?.id === role.id) executor = `${log.executor?.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("🛡️ Novo Cargo Criado")
                .setColor("Green")
                .setDescription(`**Cargo:** ${role.name} (<@&${role.id}>)\n**Criado por:** ${executor}`);
            
            await LogMinister.publish(role.guild.id, client, embed);
        }
    },

    // 🔴 EVENTO 2: CARGO DELETADO
    {
        name: Events.GuildRoleDelete,
        once: false,
        execute: async (role: Role, client: Client) => {
            let executor = "Desconhecido";
            try {
                const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
                const log = logs.entries.first();
                if (log && log.target?.id === role.id) executor = `${log.executor?.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("🗑️ Cargo Deletado")
                .setColor("Red")
                .setDescription(`**Cargo:** @${role.name}\n**Apagado por:** ${executor}`);
            
            await LogMinister.publish(role.guild.id, client, embed);
        }
    }
];