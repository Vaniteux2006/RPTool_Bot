import { EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, Message, ChannelType, GuildMember } from 'discord.js';

export default {
    name: 'serverinfo',
    description: 'Mostra informações do Servidor',

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

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const modo = interaction.options.getString('ver') || 'geral';
        
        if (modo === 'photo') {
            const icon = interaction.guild?.iconURL({ size: 1024 });
            if (icon) await interaction.reply(icon);
            else await interaction.reply("Este servidor não tem ícone.");
            return;
        }

        const fakeMessage: any = {
            guild: interaction.guild,
            author: interaction.user,
            channel: interaction.channel,
            reply: async (payload: any) => interaction.reply(payload)
        };

        await this.execute(fakeMessage, []);
    },

    async execute(message: Message | any, args: string[]) {
        const guild = message.guild;
        if (!guild) return;

        const owner = await guild.fetchOwner();
        
        const textChannels = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildVoice).size;
        const totalChannels = textChannels + voiceChannels;
        
        let banCount = 0;
        try {
             const bans = await guild.bans.fetch();
             banCount = bans.size;
        } catch (e) { banCount = 0; }

        const members = await guild.members.fetch();
        const oldMember = members
            .filter((m: GuildMember) => !m.user.bot && m.id !== guild.ownerId)
            .sort((a: GuildMember, b: GuildMember) => (a.joinedTimestamp || 0) - (b.joinedTimestamp || 0))
            .first();

        const criacao = `<t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`;

        const embed = new EmbedBuilder()
            .setColor(0xFFD700) 
            .setTitle(`🏰 Informações de ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setFooter({ text: `RPTool v1.2` })
            .addFields(
                { name: '🆔 Identidade', value: `**ID:** \`${guild.id}\`\n**Dono:** ${owner.user.tag}\n**Criado em:** ${criacao}`, inline: false },
                { name: '📊 Estatísticas', value: `**Membros:** ${guild.memberCount}\n**Bans:** ${banCount}`, inline: true },
                { name: '💬 Canais', value: `**Total:** ${totalChannels}\n**Texto:** ${textChannels} | **Voz:** ${voiceChannels}`, inline: true },
                { name: '👴 Ancião do Server', value: oldMember ? `${oldMember.user.tag} (Entrou em <t:${Math.floor(oldMember.joinedTimestamp! / 1000)}:d>)` : "Nenhum (Só tem o dono ou bots)", inline: false }
            );

        if (guild.bannerURL()) {
            embed.setImage(guild.bannerURL({ size: 1024 }));
        }

        await message.reply({ embeds: [embed] });
    }
};