import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';

// 🔍 FUNÇÃO 1: Extrai referências do texto (Ex: "Ele encontrou a [[Espada Sagrada]]")
export function parseWikiText(text: string): string[] {
    // Procura por textos entre colchetes duplos [[ ]]
    const regex = /\[\[(.*?)\]\]/g;
    const matches = [...text.matchAll(regex)];
    return matches.map(m => m[1].trim());
}

// 📖 FUNÇÃO 2: Paginador de Textões (Evita o erro de +4096 caracteres)
export async function readLongText(message: Message, baseEmbed: EmbedBuilder, text: string) {
    const CHUNK_SIZE = 4000; // Limite seguro para o description da Embed

    // Se o texto for curto, manda direto sem botões
    if (text.length <= CHUNK_SIZE) {
        baseEmbed.setDescription(text);
        return message.reply({ embeds: [baseEmbed] });
    }

    // Se for longo, fatia o texto em várias páginas
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        chunks.push(text.substring(i, i + CHUNK_SIZE));
    }

    let currentPage = 0;
    baseEmbed.setDescription(chunks[currentPage])
             .setFooter({ text: `Página ${currentPage + 1} de ${chunks.length}` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('prev_ler').setEmoji('⬅️').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('next_ler').setEmoji('➡️').setStyle(ButtonStyle.Primary)
    );

    const msg = await message.reply({ embeds: [baseEmbed], components: [row] });
    
    // Coletor de 5 minutos para o usuário ler em paz
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

    collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) {
            return i.reply({ content: "🚫 Apenas quem pediu pode folhear as páginas.", ephemeral: true });
        }

        if (i.customId === 'prev_ler' && currentPage > 0) currentPage--;
        if (i.customId === 'next_ler' && currentPage < chunks.length - 1) currentPage++;

        baseEmbed.setDescription(chunks[currentPage])
                 .setFooter({ text: `Página ${currentPage + 1} de ${chunks.length}` });

        row.components[0].setDisabled(currentPage === 0);
        row.components[1].setDisabled(currentPage === chunks.length - 1);

        await i.update({ embeds: [baseEmbed], components: [row] });
    });

    collector.on('end', () => {
        row.components.forEach(c => c.setDisabled(true));
        msg.edit({ components: [row] }).catch(() => {});
    });
}