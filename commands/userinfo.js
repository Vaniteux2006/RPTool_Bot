const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'userinfo',
    description: 'Puxa a ficha completa de um usuário',

    // --- ESTRUTURA SLASH ---
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Ver dados de um usuário')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('Quem você quer stalkear?')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('modo')
                .setDescription('O que você quer ver?')
                .addChoices(
                    { name: '📋 Ficha Completa', value: 'info' },
                    { name: '🖼️ Apenas Foto', value: 'photo' }
                )),

    // --- ADAPTADOR SLASH ---
    async executeSlash(interaction) {
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const mode = interaction.options.getString('modo') || 'info';

        // Fake Message para aproveitar a lógica pesada
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            mentions: { users: { first: () => targetUser } },
            reply: async (payload) => interaction.reply(payload)
        };

        const args = mode === 'photo' ? ['photo'] : [];
        await this.execute(fakeMessage, args);
    },

    // --- LÓGICA ORIGINAL RESTAURADA ---
    async execute(message, args) {
        
        let targetUser = message.mentions.users.first() || message.author;
        let targetMember = await message.guild.members.fetch(targetUser.id);

        // --- SUBCOMANDO: PHOTO ---
        if (args[0] && (args[0].toLowerCase() === 'photo' || args[0].toLowerCase() === 'avatar')) {
            const avatarUrl = targetUser.displayAvatarURL({ size: 1024, extension: 'png' });
            
            const embedPhoto = new EmbedBuilder()
                .setColor(targetMember.displayHexColor)
                .setTitle(`📸 Foto de ${targetUser.username}`)
                .setImage(avatarUrl);
            
            return message.reply({ embeds: [embedPhoto] });
        }

        // --- CÁLCULOS (LEGADO) ---
        
        // 1. Posição de Entrada (Rank de antiguidade) - Lógica Original
        const membersSorted = message.guild.members.cache
            .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
            .map(m => m.id);
        const joinPosition = membersSorted.indexOf(targetMember.id) + 1;

        // 2. Datas
        const criadoEm = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:D>`;
        const entrouEm = `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>`; 

        // 3. Cargos
        const roles = targetMember.roles.cache
            .filter(r => r.name !== '@everyone')
            .map(r => r) 
            .join(', ') || "Nenhum cargo";

        // MONTA O EMBED ORIGINAL
        const embed = new EmbedBuilder()
            .setColor(targetMember.displayHexColor || 0x00FF00)
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 Identidade', value: `**Nome:** ${targetUser.username}\n**Apelido:** ${targetMember.nickname || "Nenhum"}\n**ID:** \`${targetUser.id}\``, inline: false },
                { name: '📅 Datas Importantes', value: `**Criou a Conta:** ${criadoEm}\n**Entrou no Server:** ${entrouEm}`, inline: false },
                { name: '🏆 Rank de Antiguidade', value: `Este foi o membro **Nº ${joinPosition}** a entrar no servidor!`, inline: false },
                { name: '🛡️ Cargos', value: roles, inline: false }
            )
            .setFooter({ text: `RPTool v1.2` });

        message.reply({ embeds: [embed] });
        console.log("Registrado Checagem de Usuário");
    },
};