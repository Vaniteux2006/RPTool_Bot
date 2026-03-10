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
            option.setName('id')
                .setDescription('ID do usuário (Opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('modo')
                .setDescription('O que você quer ver?')
                .addChoices(
                    { name: '📋 Ficha Completa', value: 'info' },
                    { name: '🖼️ Apenas Foto', value: 'photo' }
                )),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        let targetUser = interaction.options.getUser('usuario') || interaction.user;
        const idOpt = interaction.options.getString('id');
        const mode = interaction.options.getString('modo') || 'info';

        const fakeMessage: any = {
            author: interaction.user,
            client: interaction.client,
            guild: interaction.guild,
            mentions: { users: { first: () => interaction.options.getUser('usuario') } },
            reply: async (payload: any) => interaction.reply(payload)
        };
        
        const args = [];
        if (mode === 'photo') args.push('photo');
        if (idOpt) args.push(idOpt);
        
        await this.execute(fakeMessage, args);
    },

    async execute(message: Message | any, args: string[]) {
        let targetUser = message.mentions.users.first();
        let isPhoto = args.includes('photo');

        if (!targetUser) {
            const targetId = args.find(a => a.match(/^\d{17,20}$/));
            if (targetId) {
                try {
                    targetUser = await message.client.users.fetch(targetId);
                } catch (e) {
                    return message.reply("❌ Não consegui encontrar nenhum usuário com esse ID no Discord.");
                }
            }
        }
        
        if (!targetUser) targetUser = message.author;
        
        if (isPhoto) {
            return message.reply(targetUser.displayAvatarURL({ size: 1024, extension: 'png', dynamic: true }));
        }
        
        let targetMember: GuildMember | undefined;
        if (message.guild) {
            try {
                targetMember = await message.guild.members.fetch(targetUser.id);
            } catch (e) {
                targetMember = undefined;
            }
        }

        const criadoEm = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:D>`;
        
        const embed = new EmbedBuilder()
            .setColor(targetMember?.displayHexColor || 0x00FF00)
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 Identidade', value: `**Nome:** ${targetUser.username}\n**ID:** \`${targetUser.id}\``, inline: false },
                { name: '📅 Conta Criada', value: criadoEm, inline: false }
            )
            .setFooter({ text: `RPTool v1.4.1` });

        if (targetMember && message.guild) {
            const entrouEm = `<t:${Math.floor(targetMember.joinedTimestamp! / 1000)}:F>`; 

            const membersCache = message.guild.members.cache;
            const sortedMembers = Array.from(membersCache.values())
                .sort((a: any, b: any) => (a.joinedTimestamp || 0) - (b.joinedTimestamp || 0))
                .map((m: any) => m.id);
            
            const joinPosition = sortedMembers.indexOf(targetMember.id) + 1;

            const roles = targetMember.roles.cache
                .filter((r: any) => r.name !== '@everyone')
                .map((r: any) => `<@&${r.id}>`) 
                .join(', ') || "Nenhum cargo";

            const finalRoles = roles.length > 1024 ? roles.substring(0, 1020) + "..." : roles;

            embed.addFields(
                { name: '🏰 Entrada no Servidor', value: entrouEm, inline: false },
                { name: '🏆 Rank de Antiguidade', value: `Este foi o membro **Nº ${joinPosition > 0 ? joinPosition : '?'}** a entrar!`, inline: false },
                { name: '🛡️ Cargos', value: finalRoles, inline: false }
            );
        } else {
            embed.addFields(
                { name: '🏰 Servidor', value: `*Este usuário não é um membro deste servidor (Ou o ID foi puxado de fora).*`, inline: false }
            );
        }

        await message.reply({ embeds: [embed] });
    }
};