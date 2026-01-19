const { EmbedBuilder, SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
    name: 'serverinfo',
    description: 'Mostra todas as informações e segredos do Servidor',

    // --- ESTRUTURA SLASH ---
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Mostra dados do servidor')
        .addStringOption(option =>
            option.setName('ver')
                .setDescription('O que você quer ver?')
                .addChoices(
                    { name: '🏰 Geral (Tudo)', value: 'geral' },
                    { name: '📸 Foto do Server', value: 'photo' }
                )),

    // --- ADAPTADOR SLASH ---
    async executeSlash(interaction) {
        const modo = interaction.options.getString('ver') || 'geral';
        const args = [];
        if (modo === 'photo') args.push('photo');

        // Fake Message
        const fakeMessage = {
            guild: interaction.guild,
            author: interaction.user,
            channel: interaction.channel,
            member: interaction.member,
            reply: async (payload) => {
                if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
                return interaction.reply(payload);
            }
        };

        if (modo === 'geral') await interaction.deferReply();
        await this.execute(fakeMessage, args);
    },

    // --- LÓGICA ORIGINAL RESTAURADA ---
    async execute(message, args) {
        const guild = message.guild;

        // SUBCOMANDO: PHOTO
        if (args[0] && args[0].toLowerCase() === 'photo') {
            const iconUrl = guild.iconURL({ size: 1024, extension: 'png', dynamic: true });
            if (!iconUrl) return message.reply("❌ Este servidor não tem foto!");

            const embedPhoto = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📸 Ícone de ${guild.name}`)
                .setImage(iconUrl);
            
            return message.reply({ embeds: [embedPhoto] });
        }

        // CARREGANDO DADOS (Lógica Antiga)
        // Garante que temos os membros carregados pra calcular o "Mais antigo"
        await guild.members.fetch().catch(() => {}); 

        const owner = await guild.fetchOwner();

        // Pega contagem de bans com segurança
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

        // Acha o membro mais antigo (Humano e não dono) - LÓGICA ESPECIAL
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
            .setFooter({ text: `RPTool v1.2` })
            .addFields(
                { name: '🆔 Identidade', value: `**ID:** \`${guild.id}\`\n**Dono:** ${owner.user.tag}\n**Criado em:** ${criacao}`, inline: false },
                { name: '📊 Estatísticas', value: `**Membros:** ${guild.memberCount}\n**Bans:** ${banCount}`, inline: true },
                { name: '💬 Canais', value: `**Total:** ${totalChannels}\n**Texto:** ${textChannels} | **Voz:** ${voiceChannels}`, inline: true },
                { name: '👴 Ancião do Server', value: oldMember ? `${oldMember.user.tag} (Entrou em <t:${Math.floor(oldMember.joinedTimestamp / 1000)}:d>)` : "Nenhum (Só tem o dono ou bots)", inline: false }
            );

        if (guild.bannerURL()) {
            embed.setImage(guild.bannerURL({ size: 1024 }));
        }

        message.reply({ embeds: [embed] });
        console.log("Registrado Checagem de Server");
    },
};