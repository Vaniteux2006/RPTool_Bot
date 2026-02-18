import { EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, Message, GuildMember } from 'discord.js';

export default {
    name: 'userinfo',
    description: 'Puxa a ficha de um usuário',

    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Ver dados de um usuário')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('Quem?')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('modo')
                .setDescription('O que você quer ver?')
                .addChoices(
                    { name: '📋 Ficha Completa', value: 'info' },
                    { name: '🖼️ Apenas Foto', value: 'photo' }
                )),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const mode = interaction.options.getString('modo') || 'info';

        const fakeMessage: any = {
            author: interaction.user,
            guild: interaction.guild,
            mentions: { users: { first: () => targetUser } },
            reply: async (payload: any) => interaction.reply(payload)
        };
        
        const args = mode === 'photo' ? ['photo'] : [];
        await this.execute(fakeMessage, args);
    },

    async execute(message: Message | any, args: string[]) {
        let targetUser = message.mentions.users.first() || message.author;
        
        if (args[0] === 'photo') {
            return message.reply(targetUser.displayAvatarURL({ size: 1024, extension: 'png' }));
        }
        
        let targetMember: GuildMember | undefined;
        try {
            targetMember = await message.guild.members.fetch(targetUser.id);
        } catch (e) {
            return message.reply("Usuário não está no servidor.");
        }

        if (!targetMember) return;

        const members = await message.guild.members.fetch();
        const sortedMembers = members
            .sort((a: GuildMember, b: GuildMember) => (a.joinedTimestamp || 0) - (b.joinedTimestamp || 0))
            .map((m: GuildMember) => m.id);
        
        const joinPosition = sortedMembers.indexOf(targetMember.id) + 1;

        const criadoEm = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:D>`;
        const entrouEm = `<t:${Math.floor(targetMember.joinedTimestamp! / 1000)}:F>`; 

        const roles = targetMember.roles.cache
            .filter(r => r.name !== '@everyone')
            .map(r => `<@&${r.id}>`) 
            .join(', ') || "Nenhum cargo";

        const finalRoles = roles.length > 1024 ? roles.substring(0, 1020) + "..." : roles;

        const embed = new EmbedBuilder()
            .setColor(targetMember.displayHexColor || 0x00FF00)
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 Identidade', value: `**Nome:** ${targetUser.username}\n**Apelido:** ${targetMember.nickname || "Nenhum"}\n**ID:** \`${targetUser.id}\``, inline: false },
                { name: '📅 Datas Importantes', value: `**Criou a Conta:** ${criadoEm}\n**Entrou no Server:** ${entrouEm}`, inline: false },
                { name: '🏆 Rank de Antiguidade', value: `Este foi o membro **Nº ${joinPosition}** a entrar no servidor!`, inline: false },
                { name: '🛡️ Cargos', value: finalRoles, inline: false }
            )
            .setFooter({ text: `RPTool v1.4` });

        await message.reply({ embeds: [embed] });
    }
};