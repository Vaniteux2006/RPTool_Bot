// RPTool/supercommands/resumo/modules/confirm.ts
// ─── Preview de custo ────────────────────────────────────────────────────────
// Com 1 bloco não há decisão a tomar (é o mínimo possível), então o index nem
// chama isto — não atrapalha o "manda e esquece". Acima disso, pergunta: é onde
// vale a pena reduzir o intervalo em vez de queimar a cota.
import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, Message,
} from 'discord.js';
import { TIMEOUT_CONFIRMACAO_MS } from '../config';

export async function confirmarCusto(
    loadMsg: Message,
    autorId: string,
    totalMensagens: number,
    totalBlocos: number,
): Promise<boolean> {
    const previa = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('💸 Confirmação de custo')
        .setDescription(
            `Encontrei **${totalMensagens} mensagens** no período pedido.\n\n` +
            `Resumir isso custa **${totalBlocos} requisições** da cota da IA` +
            ` (+1 se você usar o Resumo Definitivo depois).\n\n` +
            `Um intervalo menor custa menos. Quer seguir?`,
        )
        .setFooter({ text: `Dica: adicione "-y" ao comando para pular esta confirmação.` });

    await loadMsg.edit({
        content: '',
        embeds: [previa],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('resumoConf:ok').setLabel(`Gerar (${totalBlocos} requisições)`).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('resumoConf:cancelar').setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
        )],
    });

    try {
        const resposta = await loadMsg.awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === autorId && i.customId.startsWith('resumoConf:'),
            time: TIMEOUT_CONFIRMACAO_MS,
        });

        if (resposta.customId === 'resumoConf:cancelar') {
            await resposta.update({ content: '❌ Cancelado. Nenhuma requisição foi usada.', embeds: [], components: [] });
            return false;
        }
        await resposta.update({ content: '⏳ Confirmado, começando...', embeds: [], components: [] });
        return true;
    } catch {
        // Ninguém clicou: cancelar é o padrão seguro para a cota.
        await loadMsg.edit({
            content: '⌛ Confirmação expirou — nenhuma requisição foi usada.\n💡 Rode com `-y` no fim do comando para pular a confirmação e deixar o bot trabalhando sozinho.',
            embeds: [],
            components: [],
        }).catch(() => { });
        return false;
    }
}
