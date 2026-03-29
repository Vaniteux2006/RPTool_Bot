import { Message, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';

export default async function handleList(message: Message, args: string[], userId: string) {
    let targetId = userId;
    if (message.mentions.users.first()) {
        targetId = message.mentions.users.first()!.id;
    } else if (args[1] && args[1].length > 15) {
        targetId = args[1];
    }

    const query = { $or: [{ adminId: targetId }, { duoIds: targetId }] };
    const totalDocs = await OCModel.countDocuments(query);
    if (totalDocs === 0) return message.reply("📭 Nenhum OC encontrado.");

    const generateEmbed = async (page: number) => {
        const pageSize = 5; 
        const skip = (page - 1) * pageSize;

        const ocs = await OCModel.find(query).skip(skip).limit(pageSize);
        const totalPages = Math.ceil(totalDocs / pageSize);

        const listStr = ocs.map(t => {
            const isOwner = t.adminId === targetId;
            const icon = isOwner ? "👑" : "🤝";
            const aiStatus = t.ai?.enabled ? "🤖 [IA ON]" : "";

            const created = t.createdAt ? t.createdAt.toLocaleDateString('pt-BR') : "Desconhecido";
            const bday = t.realBirthday ? ` | 🎉 ${t.realBirthday.getDate()}/${t.realBirthday.getMonth() + 1}` : "";

            return `**${icon} ${t.name}** ${aiStatus}\n> 🗣️ **Padrão:** \`${t.prefix}text${t.suffix}\`\n> 💬 **Msgs:** ${t.messageCount}\n> 📂 **Grupo:** ${t.group || "Nenhum"}\n> 📅 **Criado:** ${created}${bday}\n> 🖼️ [Ver Avatar](${t.avatar})`;
        }).join("\n\n");

        return {
            embeds: [{
                title: `📒 Lista de OCs (${page}/${totalPages})`,
                description: listStr,
                color: 0xFFFF00, 
                footer: { text: `Total de OCs: ${totalDocs}` },
                thumbnail: { url: ocs[0]?.avatar } 
            }],
            totalPages
        };
    };

    let currentPage = 1;
    const { embeds, totalPages } = await generateEmbed(currentPage);

    if (totalPages === 1) {
        return message.reply({ embeds });
    }

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('⬅️ Anterior')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true), 
            new ButtonBuilder() 
                .setCustomId('jump_page')
                .setLabel('🔢 Pular')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('Próximo ➡️')
                .setStyle(ButtonStyle.Primary)
        );

    const msg = await message.reply({ embeds, components: [row] });

    const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== userId) {
            return i.reply({ content: "🚫 Só quem pediu a lista pode mexer.", ephemeral: true });
        }

        if (i.customId === 'jump_page') {
            const modal = new ModalBuilder()
                .setCustomId('modal_jump_page')
                .setTitle('Pular para Página');

            const pageInput = new TextInputBuilder()
                .setCustomId('page_input')
                .setLabel(`Digite a página (1 a ${totalPages}):`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(pageInput));

            await i.showModal(modal);

            try {
                const modalSubmit = await i.awaitModalSubmit({ 
                    filter: m => m.user.id === userId && m.customId === 'modal_jump_page', 
                    time: 60000 
                });
                
                const inputPage = parseInt(modalSubmit.fields.getTextInputValue('page_input'));

                if (isNaN(inputPage) || inputPage < 1 || inputPage > totalPages) {
                    return modalSubmit.reply({ content: `❌ Página inválida. Digite um número de 1 a ${totalPages}.`, ephemeral: true });
                }

                currentPage = inputPage;
                const newData = await generateEmbed(currentPage);

                row.components[0].setDisabled(currentPage === 1);
                row.components[2].setDisabled(currentPage === totalPages);

                await modalSubmit.update({ embeds: newData.embeds, components: [row] });
            } catch (e) {
                // Erro silencioso ou timeout do modal
            }
            return; 
        }

        if (i.customId === 'prev_page' && currentPage > 1) currentPage--;
        if (i.customId === 'next_page' && currentPage < totalPages) currentPage++;

        const newData = await generateEmbed(currentPage);

        row.components[0].setDisabled(currentPage === 1);
        row.components[2].setDisabled(currentPage === totalPages);

        await i.update({ embeds: newData.embeds, components: [row] });
    });

    collector.on('end', () => {
        row.components.forEach(b => b.setDisabled(true));
        msg.edit({ components: [row] }).catch(() => { });
    });
}