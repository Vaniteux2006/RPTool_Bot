// RPTool/supercommands/exportchat/modules/confirm.ts
// ─── Confirmação via botão ────────────────────────────────────────────────────

import {
    Message, TextChannel,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';

export async function askConfirmation(
    commandChannel: TextChannel,
    userId:         string,
    estimatedFiles: number,
): Promise<boolean> {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('exp_yes')
            .setLabel('✅ Confirmar')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('exp_no')
            .setLabel('❌ Cancelar')
            .setStyle(ButtonStyle.Secondary),
    );

    const confirmMsg = await commandChannel.send({
        content:
            `<@${userId}> ⚠️ **Atenção** — este export vai gerar aproximadamente ` +
            `**${estimatedFiles}** arquivo(s) HTML.\nTem certeza que deseja continuar?`,
        components: [row],
    });

    try {
        const btn = await confirmMsg.awaitMessageComponent({
            filter:        i => i.user.id === userId && ['exp_yes', 'exp_no'].includes(i.customId),
            componentType: ComponentType.Button,
            time:          60_000,
        });
        await btn.deferUpdate();

        if (btn.customId === 'exp_no') {
            await confirmMsg.edit({ content: '🚫 Exportação cancelada.', components: [] });
            return false;
        }

        await confirmMsg.edit({ content: '✅ Confirmado! Iniciando exportação...', components: [] });
        return true;

    } catch {
        await confirmMsg.edit({ content: '⏱️ Tempo esgotado. Exportação cancelada.', components: [] });
        return false;
    }
}
