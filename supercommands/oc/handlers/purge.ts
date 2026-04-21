import { Message, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';

export default async function handlePurge(message: Message, args: string[], userId: string) {
    const dangerEmbed = {
        title: "⚠️ PERIGO: ZONA DE DESTRUIÇÃO",
        description: "Você está prestes a **APAGAR TODOS** os seus OCs.\nEssa ação é irreversível.\n\nTem certeza absoluta?",
        color: 0xFF0000,
        footer: { text: "Você tem 15 segundos para decidir." }
    };

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('purge_confirm')
                .setLabel('🔥 SIM, APAGAR TUDO')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('purge_cancel')
                .setLabel('❌ Cancelar')
                .setStyle(ButtonStyle.Secondary)
        );

    const msg = await message.reply({ embeds: [dangerEmbed], components: [row] });

    // Coletor esperando o clique do botão por 15 segundos
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });

    collector.on('collect', async (i) => {
        // Bloqueia caso outro usuário tente clicar
        if (i.user.id !== userId) {
            return i.reply({ content: "🚫 Só quem pediu pode confirmar.", ephemeral: true });
        }

        if (i.customId === 'purge_confirm') {
            // Comportamento destrutivo original: apaga tudo que pertence ao usuário
            await OCModel.deleteMany({ adminId: userId });
            await i.update({ content: "💥 Todos os seus OCs foram destruídos.", embeds: [], components: [] });
            collector.stop("confirmed");
        } 
        else if (i.customId === 'purge_cancel') {
            await i.update({ content: "✅ Ação cancelada. Seus OCs estão a salvo.", embeds: [], components: [] });
            collector.stop("canceled");
        }
    });

    collector.on('end', (collected, reason) => {
        // Se esgotar o tempo (15 segundos) e não tiver confirmado/cancelado
        if (reason === "time") {
            msg.edit({ content: "⏳ Tempo esgotado. Ação cancelada.", embeds: [], components: [] }).catch(() => {});
        }
    });
}