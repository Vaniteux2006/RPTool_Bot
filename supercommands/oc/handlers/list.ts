import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';

export default async function handleList(message: Message, args: string[], userId: string) {
    const userOCs = await OCModel.find({ adminId: userId });
    
    if (userOCs.length === 0) {
        return message.reply("📌 Você ainda não tem nenhum OC registrado.");
    }

    const itemsPerPage = 5;
    let currentPage = 0;
    const totalPages = Math.ceil(userOCs.length / itemsPerPage);

    const generateEmbed = (page: number) => {
        const start = page * itemsPerPage;
        const currentOCs = userOCs.slice(start, start + itemsPerPage);

        const embed = new EmbedBuilder()
            .setTitle(`📚 Seus OCs (${userOCs.length} no total)`)
            .setColor('#2b2d31') // Cor escura do Discord
            .setFooter({ text: `Página ${page + 1} de ${totalPages}` });

        let description = "";
        currentOCs.forEach(oc => {
            const prefix = oc.prefix ? `\`${oc.prefix}\`` : "";
            const suffix = oc.suffix ? `\`${oc.suffix}\`` : "";
            const group = oc.group ? ` | 📂 Grupo: **${oc.group}**` : "";
            description += `**${oc.name}**\nUso: ${prefix}Texto${suffix}${group}\n\n`;
        });

        embed.setDescription(description || "Nada a exibir nesta página.");
        return embed;
    };

    // Se só tiver 1 página, já manda sem botões para economizar processo
    if (totalPages <= 1) {
        return message.reply({ embeds: [generateEmbed(0)] });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('⬅️ Anterior').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('next').setLabel('Próximo ➡️').setStyle(ButtonStyle.Primary)
    );

    const msg = await message.reply({ embeds: [generateEmbed(currentPage)], components: [row] });

    // O coletor de cliques nos botões dura 1 minuto
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async (i) => {
        if (i.user.id !== userId) {
            return i.reply({ content: "❌ Você não pode usar os botões do menu dos outros.", ephemeral: true });
        }

        if (i.customId === 'prev') currentPage--;
        if (i.customId === 'next') currentPage++;

        // Desativa os botões nos limites (Página 0 e Última Página)
        row.components[0].setDisabled(currentPage === 0);
        row.components[1].setDisabled(currentPage === totalPages - 1);

        await i.update({ embeds: [generateEmbed(currentPage)], components: [row] });
    });

    collector.on('end', () => {
        // Desativa tudo quando o tempo acaba
        row.components.forEach(c => c.setDisabled(true));
        msg.edit({ components: [row] }).catch(() => {}); // catch vazio caso a msg já tenha sido deletada
    });
}