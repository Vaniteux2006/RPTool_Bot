// RPTool/tools/utils/discord/paginate.ts
// ─── Paginação por sessão em Map + handler global ────────────────────────────
// Generalização do padrão do resumo (ver supercommands/resumo/interactions.ts):
// o collector do discord.js morre em ~10 min e quem volta depois encontra os
// botões mortos. Aqui a sessão vive num Map servido por um handler global do
// EventCheckout — sobrevive a qualquer tempo de espera. Não sobrevive a restart
// do bot; nesse caso o clique responde com um aviso claro em vez de nada.
//
// Uso:
//   const paginas = [embed1, embed2, ...];
//   const msg = await message.reply({ embeds: [paginas[0]], components: [/* via montarBotoesPaginacao */] });
//   criarSessaoPaginacao(msg, { paginas, autorId: message.author.id });
// O handler global cuida de prev/next dali em diante.
import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    Interaction, Message, MessageFlags,
} from 'discord.js';
import { EventCheckout } from '../../eventCheckout';

const TTL_SESSAO_MS = 6 * 60 * 60 * 1000; // 6h — mesmo TTL do resumo

interface SessaoPaginacao {
    paginas: EmbedBuilder[];
    paginaAtual: number;
    /** Se definido, só este usuário navega. Sem valor: painel público. */
    autorId?: string;
    criadoEm: number;
}

const sessoes = new Map<string, SessaoPaginacao>();

function limparSessoesVelhas(): void {
    const agora = Date.now();
    for (const [id, s] of sessoes) {
        if (agora - s.criadoEm > TTL_SESSAO_MS) sessoes.delete(id);
    }
}

export function montarBotoesPaginacao(s: { paginaAtual: number; total: number }): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('paginate:prev').setLabel('◀ Anterior')
            .setStyle(ButtonStyle.Secondary).setDisabled(s.paginaAtual === 0),
        new ButtonBuilder().setCustomId('paginate:page').setLabel(`${s.paginaAtual + 1}/${s.total}`)
            .setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('paginate:next').setLabel('Próximo ▶')
            .setStyle(ButtonStyle.Secondary).setDisabled(s.paginaAtual === s.total - 1),
    );
}

/** Registra a sessão de paginação da mensagem (chaveada pelo id da mensagem). */
export function criarSessaoPaginacao(mensagem: Message, opts: { paginas: EmbedBuilder[]; autorId?: string }): void {
    limparSessoesVelhas();
    sessoes.set(mensagem.id, {
        paginas: opts.paginas,
        paginaAtual: 0,
        autorId: opts.autorId,
        criadoEm: Date.now(),
    });
}

// ─── Handler global ───────────────────────────────────────────────────────────
EventCheckout.onInteractionCreate('discord.paginate', async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'paginate:prev' && interaction.customId !== 'paginate:next') return;

    const sessao = sessoes.get(interaction.message.id);
    if (!sessao) {
        await interaction.reply({
            content: '⏳ Esta paginação expirou (ou o bot reiniciou). Rode o comando de novo.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return;
    }

    if (sessao.autorId && interaction.user.id !== sessao.autorId) {
        await interaction.reply({
            content: '❌ Só quem pediu o comando pode navegar nestas páginas.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return;
    }

    sessao.paginaAtual += interaction.customId === 'paginate:next' ? 1 : -1;
    sessao.paginaAtual = Math.max(0, Math.min(sessao.paginaAtual, sessao.paginas.length - 1));

    await interaction.update({
        embeds: [sessao.paginas[sessao.paginaAtual]],
        components: [montarBotoesPaginacao({ paginaAtual: sessao.paginaAtual, total: sessao.paginas.length })],
    }).catch(() => null);
});
