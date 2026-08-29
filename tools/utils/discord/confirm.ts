// RPTool/tools/utils/discord/confirm.ts
// ─── Confirmação Sim/Não via botões ──────────────────────────────────────────
// Generalização do padrão maduro do exportchat/resumo: timeout, filtro por
// autor e botões desabilitados/removidos no fim. Substitui as reimplementações
// de ban/kick/fatos/oc purge/inventory levar/futebol team.
import {
    SendableChannels,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';

export interface AskConfirmOpts {
    /** Texto da pergunta (pode conter menção/markdown). */
    texto: string;
    /** Tempo máximo de espera pelo clique. Default 60s. */
    timeoutMs?: number;
    /** Botão de confirmar em vermelho (ações destrutivas). Default true. */
    perigo?: boolean;
    /** Rótulos custom. */
    labelSim?: string;
    labelNao?: string;
    /** Mensagens de desfecho (editadas na própria mensagem de confirmação). */
    msgConfirmado?: string;
    msgCancelado?: string;
    msgTimeout?: string;
}

/**
 * Pergunta Sim/Não no canal e espera o clique do próprio `userId`.
 * Resolve true só com confirmação explícita; timeout/cancelamento → false.
 */
export async function askConfirm(
    channel: SendableChannels,
    userId: string,
    opts: AskConfirmOpts,
): Promise<boolean> {
    const {
        texto,
        timeoutMs = 60_000,
        perigo = true,
        labelSim = '✅ Confirmar',
        labelNao = '❌ Cancelar',
        msgConfirmado = '✅ Confirmado!',
        msgCancelado = '🚫 Cancelado.',
        msgTimeout = '⏱️ Tempo esgotado — cancelado por segurança.',
    } = opts;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('confirm_yes').setLabel(labelSim)
            .setStyle(perigo ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('confirm_no').setLabel(labelNao)
            .setStyle(ButtonStyle.Secondary),
    );

    const confirmMsg = await channel.send({ content: texto, components: [row] });

    try {
        const btn = await confirmMsg.awaitMessageComponent({
            filter: i => i.user.id === userId && ['confirm_yes', 'confirm_no'].includes(i.customId),
            componentType: ComponentType.Button,
            time: timeoutMs,
        });
        await btn.deferUpdate();

        if (btn.customId === 'confirm_no') {
            await confirmMsg.edit({ content: msgCancelado, components: [] }).catch(() => null);
            return false;
        }
        await confirmMsg.edit({ content: msgConfirmado, components: [] }).catch(() => null);
        return true;
    } catch {
        await confirmMsg.edit({ content: msgTimeout, components: [] }).catch(() => null);
        return false;
    }
}
