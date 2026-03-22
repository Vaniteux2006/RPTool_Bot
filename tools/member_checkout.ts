import { Client, GuildMember, EmbedBuilder } from 'discord.js';
import autoroleCommand from '../commands/autorole';
import { WelcomeModel } from './models/Outros';
import { getAverageColor } from 'fast-average-color-node';
import { LogMinister } from './utils/LogMinister';

export default async function runMemberChecks(member: GuildMember, client: Client) {
    console.log(`📥 [CATRACA] ${member.user.tag} entrou no servidor: ${member.guild.name}`);

    // 1️⃣ DAR O CARGO AUTOMÁTICO (AUTOROLE)
    try {
        await autoroleCommand.giveRole(member);
    } catch (e) {
        console.error("❌ [CATRACA] Erro ao dar Autorole:", e);
    }

    // 2️⃣ MENSAGEM DE BOAS-VINDAS (WELCOME)
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
    } catch (error) { 
        console.error("❌ [CATRACA] Erro ao enviar Welcome:", error); 
    }

    // 3️⃣ MINISTÉRIO DO LOG (AUDITORIA)
    try {
        const logEmbed = new EmbedBuilder()
            .setTitle("📥 Membro Entrou")
            .setColor("Green")
            .setThumbnail(member.user.displayAvatarURL())
            .setDescription(`**Usuário:** ${member.user.tag} (<@${member.id}>)\n**Conta criada em:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
            .setTimestamp();
        await LogMinister.publish(member.guild.id, client, logEmbed);
    } catch (e) {
        console.error("❌ [CATRACA] Erro ao enviar Log:", e);
    }
}