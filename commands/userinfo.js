const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'userinfo',
    description: 'Puxa a ficha completa de um usuário',
    async execute(message, args) {
        
        // Define quem é o alvo: Mencionado OU quem enviou a mensagem
        let targetUser = message.mentions.users.first() || message.author;
        let targetMember = await message.guild.members.fetch(targetUser.id);

        // --- SUBCOMANDO: PHOTO ---
        if (args[0] && args[0].toLowerCase() === 'photo') {
            const avatarUrl = targetUser.displayAvatarURL({ size: 1024, extension: 'png' });
            
            const embedPhoto = new EmbedBuilder()
                .setColor(targetMember.displayHexColor)
                .setTitle(`📸 Foto de ${targetUser.username}`)
                .setImage(avatarUrl);
            
            return message.reply({ embeds: [embedPhoto] });
        }

        // --- CÁLCULOS ---
        
        // 1. Posição de Entrada (Rank de antiguidade)
        // Pega todos os membros, ordena por data de entrada
        const membersSorted = message.guild.members.cache
            .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
            .map(m => m.id);
        const joinPosition = membersSorted.indexOf(targetMember.id) + 1;

        // 2. Datas
        const criadoEm = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:D>`;
        const entrouEm = `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>`; // F mostra data e hora completa

        // 3. Cargos (ignora o @everyone)
        const roles = targetMember.roles.cache
            .filter(r => r.name !== '@everyone')
            .map(r => r) // Mantém o objeto pra ficar clicável
            .join(', ') || "Nenhum cargo";

        // MONTA O EMBED
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
            .setFooter({ text: `RPTool v1.1 • Solicitado por ${message.author.username}` });

        message.reply({ embeds: [embed] });
    },
};