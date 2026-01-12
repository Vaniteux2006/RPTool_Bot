const { EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    name: 'serverinfo',
    description: 'Mostra todas as informações e segredos do Servidor',
    async execute(message, args) {
        const guild = message.guild;

        // --- SUBCOMANDO: PHOTO ---
        if (args[0] && args[0].toLowerCase() === 'photo') {
            const iconUrl = guild.iconURL({ size: 1024, extension: 'png' });
            if (!iconUrl) return message.reply("❌ Este servidor não tem foto!");

            const embedPhoto = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📸 Ícone de ${guild.name}`)
                .setImage(iconUrl);
            
            return message.reply({ embeds: [embedPhoto] });
        }

        // --- CARREGANDO DADOS (Pode demorar um pouquinho em servers grandes) ---
        // Garante que temos os membros carregados pra calcular o "Mais antigo"
        await guild.members.fetch(); 

        // Pega o dono
        const owner = await guild.fetchOwner();

        // Pega contagem de bans (precisa de permissão, se falhar, retorna "Sem permissão")
        let banCount = "N/A (Sem Permissão)";
        try {
            const bans = await guild.bans.fetch();
            banCount = bans.size.toString();
        } catch (e) {
            banCount = "🔒 ?";
        }

        // Calcula canais
        const totalChannels = guild.channels.cache.size;
        const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;

        // Acha o membro mais antigo (Humano e não dono)
        const oldMember = guild.members.cache
            .filter(m => !m.user.bot && m.id !== guild.ownerId)
            .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
            .first();

        // Formata datas
        const criacao = `<t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`;

        // MONTA O EMBED
        const embed = new EmbedBuilder()
            .setColor(0xFFD700) // Dourado
            .setTitle(`🏰 Informações de ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '🆔 Identidade', value: `**ID:** \`${guild.id}\`\n**Dono:** ${owner.user.tag}\n**Criado em:** ${criacao}`, inline: false },
                { name: '📊 Estatísticas', value: `**Membros:** ${guild.memberCount}\n**Bans:** ${banCount}`, inline: true },
                { name: '💬 Canais', value: `**Total:** ${totalChannels}\n**Texto:** ${textChannels} | **Voz:** ${voiceChannels}`, inline: true },
                { name: '👴 Ancião do Server', value: oldMember ? `${oldMember.user.tag} (Entrou em <t:${Math.floor(oldMember.joinedTimestamp / 1000)}:d>)` : "Nenhum (Só tem o dono ou bots)", inline: false }
            );
            
            

            // Se tiver Banner, adiciona
            if (guild.bannerURL()) {
            embed.setImage(guild.bannerURL({ size: 1024 }));
        }

        message.reply({ embeds: [embed] });
        console.log("Registrado Checagem de Server")
    },
};