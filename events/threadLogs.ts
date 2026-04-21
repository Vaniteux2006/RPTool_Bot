import { Events, AnyThreadChannel, Client, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { LogMinister } from '../tools/utils/LogMinister';

export default [
    // 🟢 THREAD CRIADA
    {
        name: Events.ThreadCreate,
        once: false,
        execute: async (thread: AnyThreadChannel, newlyCreated: boolean, client: Client) => {
            // Só avisa se for uma thread recém-criada (ignora se o bot só descobriu uma thread velha agora)
            if (!newlyCreated) return; 

            let executor = "Desconhecido";
            try {
                const logs = await thread.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ThreadCreate });
                const log = logs.entries.first();
                if (log && log.target?.id === thread.id) executor = `${log.executor?.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("🧵 Novo Tópico (Thread) Criado")
                .setColor("Green")
                .setDescription(`**Nome:** <#${thread.id}>\n**Canal Pai:** <#${thread.parentId}>\n**Criado por:** ${executor}`)
                .setTimestamp();
            
            await LogMinister.publish(thread.guild.id, client, embed);
        }
    },

    // 🔴 THREAD DELETADA
    {
        name: Events.ThreadDelete,
        once: false,
        execute: async (thread: AnyThreadChannel, client: Client) => {
            let executor = "Desconhecido";
            try {
                const logs = await thread.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ThreadDelete });
                const log = logs.entries.first();
                if (log && log.target?.id === thread.id) executor = `${log.executor?.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle("🗑️ Tópico (Thread) Deletado")
                .setColor("Red")
                .setDescription(`**Nome:** #${thread.name}\n**Canal Pai:** <#${thread.parentId}>\n**Apagado por:** ${executor}`)
                .setTimestamp();
            
            await LogMinister.publish(thread.guild.id, client, embed);
        }
    }
];