import { EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, Message, ChannelType, GuildMember } from 'discord.js';

export default {
    name: 'serverinfo',
    description: 'Mostra informações do Servidor',

    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Mostra dados do servidor')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('ID do servidor (Opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('ver')
                .setDescription('O que você quer ver?')
                .addChoices(
                    { name: '🏰 Geral (Tudo)', value: 'geral' },
                    { name: '📸 Foto do Server', value: 'photo' }
                )),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const modo = interaction.options.getString('ver') || 'geral';
        const idOpt = interaction.options.getString('id');
        
        const fakeMessage: any = {
            guild: interaction.guild,
            client: interaction.client,
            author: interaction.user,
            channel: interaction.channel,
            reply: async (payload: any) => interaction.reply(payload)
        };

        const args = [];
        if (modo === 'photo') args.push('photo');
        if (idOpt) args.push(idOpt);

        await this.execute(fakeMessage, args);
    },

    async execute(message: Message | any, args: string[]) {
        let guild = message.guild;
        
        const targetId = args.find(a => a.match(/^\d{17,20}$/));
        if (targetId) {
            try {
                guild = await message.client.guilds.fetch(targetId);
            } catch (e) {
                return message.reply("❌ Não consegui encontrar o servidor. O bot precisa estar nele para puxar os dados!");
            }
        }

        if (!guild) return;

        if (args.includes('photo')) {
            const icon = guild.iconURL({ size: 1024, dynamic: true, extension: 'png' });
            if (icon) return message.reply(icon);
            return message.reply("Este servidor não tem ícone.");
        }

        const owner = await guild.fetchOwner();
        
        const textChannels = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildVoice).size;
        const totalChannels = textChannels + voiceChannels;
        
        let banCount = 0;
        try {
             const bans = await guild.bans.fetch();
             banCount = bans.size;
        } catch (e) { banCount = 0; }

        const members = guild.members.cache;
        const oldMember = members
            .filter((m: GuildMember) => !m.user.bot && m.id !== guild.ownerId)
            .sort((a: GuildMember, b: GuildMember) => (a.joinedTimestamp || 0) - (b.joinedTimestamp || 0))
            .first();

        const criacao = `<t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`;

        const embed = new EmbedBuilder()
            .setColor(0xFFD700) 
            .setTitle(`🏰 Informações de ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setFooter({ text: `RPTool v1.4.1` })
            .addFields(
                { name: '🆔 Identidade', value: `**ID:** \`${guild.id}\`\n**Dono:** ${owner.user.tag}\n**Criado em:** ${criacao}`, inline: false },
                { name: '📊 Estatísticas', value: `**Membros:** ${guild.memberCount}\n**Bans:** ${banCount}`, inline: true },
                { name: '💬 Canais', value: `**Total:** ${totalChannels}\n**Texto:** ${textChannels} | **Voz:** ${voiceChannels}`, inline: true },
                { name: '👴 Ancião', value: oldMember ? `${oldMember.user.tag} (Entrou em <t:${Math.floor(oldMember.joinedTimestamp! / 1000)}:d>)` : "Nenhum", inline: false }
            );

        if (guild.bannerURL()) {
            embed.setImage(guild.bannerURL({ size: 1024 }));
        }

        await message.reply({ embeds: [embed] });
    }
};