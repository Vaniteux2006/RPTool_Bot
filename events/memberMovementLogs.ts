import { Events, GuildMember, Client, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { WelcomeModel } from '../tools/models/Outros';
import { getAverageColor } from 'fast-average-color-node';
import autoroleCommand from '../commands/autorole'; 
import { LogMinister } from '../tools/utils/LogMinister';

export default [
    // 🟢 MEMBRO ENTROU
    {
        name: Events.GuildMemberAdd,
        once: false,
        execute: async (member: GuildMember, client: Client) => {
            // 1. Autorole (Lógica original do seu bot)
            try { await autoroleCommand.giveRole(member); } catch (e) {}

            // 2. Mensagem de Boas Vindas (Lógica original)
            try {
                const config = await WelcomeModel.findOne({ guildId: member.guild.id });
                if (config && config.channelId) {
                    const channel = member.guild.channels.cache.get(config.channelId);
                    if (channel && channel.isTextBased()) {
                        let msg = config.joinMsg.replace(/{user}/g, `<@${member.id}>`)
                            .replace(/{server}/g, member.guild.name)
                            .replace(/{count}/g, member.guild.memberCount.toString());

                        let embedColor = 0x5865F2; 
                        try {
                            const url = member.user.displayAvatarURL({ extension: 'png', size: 256 });
                            const color = await getAverageColor(url);
                            embedColor = parseInt(color.hex.replace('#', ''), 16);
                        } catch (e) {}

                        const embed = new EmbedBuilder().setColor(embedColor).setDescription(msg).setThumbnail(member.user.displayAvatarURL()); 
                        await (channel as any).send({ embeds: [embed] });
                    }
                }
            } catch (error) { console.error("Erro no Welcome:", error); }

            // 3. MINISTÉRIO DO LOG (Auditoria)
            const logEmbed = new EmbedBuilder()
                .setTitle("📥 Membro Entrou")
                .setColor("Green")
                .setThumbnail(member.user.displayAvatarURL())
                .setDescription(`**Usuário:** ${member.user.tag} (<@${member.id}>)\n**Conta criada em:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
                .setTimestamp();
            await LogMinister.publish(member.guild.id, client, logEmbed);
        }
    },

    // 🔴 MEMBRO SAIU
    {
        name: Events.GuildMemberRemove,
        once: false,
        execute: async (member: GuildMember, client: Client) => {
            // 1. Mensagem de Saída (Lógica original do seu bot)
            try {
                const config = await WelcomeModel.findOne({ guildId: member.guild.id });
                if (config && config.channelId) {
                    const channel = member.guild.channels.cache.get(config.channelId);
                    if (channel && channel.isTextBased()) {
                        const banLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(()=>null);
                        const banLog = banLogs?.entries.first();
                        let isBan = (banLog && banLog.target.id === member.id && Date.now() - banLog.createdTimestamp < 5000);

                        const kickLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick }).catch(()=>null);
                        const kickLog = kickLogs?.entries.first();
                        let isKick = (!isBan && kickLog && kickLog.target.id === member.id && Date.now() - kickLog.createdTimestamp < 5000);

                        let rawMsg = config.leaveMsg;
                        let embedColor = 0x1A2B4C;

                        if (isBan) { rawMsg = config.banMsg; embedColor = 0xFF0000; } 
                        else if (isKick) { rawMsg = config.kickMsg; embedColor = 0xFFFFFF; }

                        let msg = rawMsg.replace(/{user}/g, `**${member.user.username}**`).replace(/{server}/g, member.guild.name).replace(/{count}/g, member.guild.memberCount.toString());
                        const embed = new EmbedBuilder().setColor(embedColor).setDescription(msg).setThumbnail(member.user.displayAvatarURL());
                        await (channel as any).send({ embeds: [embed] });
                    }
                }
            } catch (error) {}

            // 2. MINISTÉRIO DO LOG (Auditoria)
            const logEmbed = new EmbedBuilder()
                .setTitle("📤 Membro Saiu")
                .setColor("Red")
                .setThumbnail(member.user.displayAvatarURL())
                .setDescription(`**Usuário:** ${member.user.tag} (<@${member.id}>)`)
                .setTimestamp();
            await LogMinister.publish(member.guild.id, client, logEmbed);
        }
    }
];