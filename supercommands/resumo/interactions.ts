// RPTool/supercommands/resumo/interactions.ts
// ─── Sessões de paginação + botão do Resumo Definitivo ───────────────────────
// O collector do discord.js morria em 10 min. Como o comando é "manda e esquece",
// quem voltava horas depois encontrava os botões mortos e só a primeira página.
// A sessão agora vive num Map servido por um handler global do EventCheckout:
// sobrevive a qualquer tempo de espera. Não sobrevive a restart do bot — nesse
// caso o clique responde com um aviso claro em vez de não fazer nada.
import {
    ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle,
    EmbedBuilder, Interaction, Message, MessageFlags,
} from 'discord.js';
import { EventCheckout } from '../../tools/eventCheckout';
import { getGuildAIConfig } from '../../tools/utils/tokenHelper';
import { TTL_SESSAO_MS } from './config';
import { BlocoResumo, Interrupcao, SessaoResumo } from './types';
import { chamarIAResumo, parseAIJSON } from './modules/aiClient';
import { atrasoBackoff, classificarErroIA, horasAteViradaQuota } from './modules/errors';
import { montarSuperEmbed } from './modules/pages';
import { SCHEMA_SUPER, promptSuper } from './modules/prompts';

const BOTOES_SESSAO = new Set(['resumo:prev', 'resumo:next', 'resumo:super']);

const sessoes = new Map<string, SessaoResumo>();

function limparSessoesVelhas(): void {
    const agora = Date.now();
    for (const [id, s] of sessoes) {
        if (agora - s.criadoEm > TTL_SESSAO_MS) sessoes.delete(id);
    }
}

export function montarBotoes(s: SessaoResumo): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('resumo:prev').setLabel('◀ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(s.paginaAtual === 0),
        new ButtonBuilder().setCustomId('resumo:next').setLabel('Próximo ▶').setStyle(ButtonStyle.Secondary).setDisabled(s.paginaAtual === s.paginas.length - 1),
    );
    // Some se já foi gerado (senão cada clique repetido era mais uma requisição)
    // ou se a IA já falhou de forma não recuperável (só levaria a outra falha).
    if (!s.superJaGerado && !s.interrompido) {
        const label = s.blocoUnico ? '🌟 Resumo Definitivo' : '🌟 Resumo Definitivo (usa 1 requisição)';
        row.addComponents(new ButtonBuilder().setCustomId('resumo:super').setLabel(label).setStyle(ButtonStyle.Success));
    }
    return row;
}

// Chamada pelo index no fim do pipeline. A sessão é chaveada pelo id da mensagem
// de status, que já existe — dá pra registrar antes de editar e montar os botões
// numa tacada só.
export function criarSessao(opts: {
    mensagem: Message;
    autorId: string;
    guildId: string;
    paginas: EmbedBuilder[];
    resumos: BlocoResumo[];
    blocoUnico: boolean;
    interrompido: Interrupcao | null;
}): SessaoResumo {
    limparSessoesVelhas();
    const sessao: SessaoResumo = {
        autorId: opts.autorId,
        guildId: opts.guildId,
        paginas: opts.paginas,
        paginaAtual: 0,
        resumos: opts.resumos,
        blocoUnico: opts.blocoUnico,
        superJaGerado: false,
        interrompido: opts.interrompido,
        criadoEm: Date.now(),
    };
    sessoes.set(opts.mensagem.id, sessao);
    return sessao;
}

async function gerarSuperResumo(i: ButtonInteraction, sessao: SessaoResumo): Promise<void> {
    // Bloco único: o arco geral veio junto na primeira requisição. Custo zero.
    if (sessao.blocoUnico) {
        sessao.superJaGerado = true;
        sessao.paginas.push(montarSuperEmbed(sessao.resumos[0] || {}));
        sessao.paginaAtual = sessao.paginas.length - 1;
        await i.update({
            content: '✨ **Resumo Definitivo** (sem custo de requisição)',
            embeds: [sessao.paginas[sessao.paginaAtual]],
            components: [montarBotoes(sessao)],
        });
        return;
    }

    await i.update({ content: '⏳ **Compilando o Resumo Definitivo...** 🌟', components: [] });
    const msg = i.message;

    // Chave resolvida AGORA, não na hora do comando: entre um e outro podem ter
    // passado horas e a chave do servidor pode ter mudado (ou sumido) no rp!token.
    const aiConfig = await getGuildAIConfig(sessao.guildId);
    if (!aiConfig) {
        await msg.edit({
            content: '❌ **Nenhuma IA está configurada para este servidor** (a chave foi removida depois que o resumo foi gerado — veja `rp!token`).\n📄 O resumo por blocos continua disponível abaixo.',
            components: [montarBotoes(sessao)],
        }).catch(() => { });
        return;
    }

    const prompt = promptSuper(sessao.resumos);

    let bruto = '';
    let tentativa = 1;
    let ok = false;

    while (!ok) {
        try {
            bruto = await chamarIAResumo(prompt, aiConfig, SCHEMA_SUPER);
            ok = true;
        } catch (error: any) {
            const falha = classificarErroIA(error);

            if (falha.tipo === 'sobrecarga' || falha.tipo === 'ratelimit') {
                const espera = falha.esperaSegundos ?? atrasoBackoff(tentativa);
                const rotulo = falha.tipo === 'sobrecarga'
                    ? `🔥 **ERRO 503!** 🍟 Servidores lotados.`
                    : `⏱️ **Rate limit da IA.**`;
                console.warn(`[RESUMO] Retry ${tentativa} no super resumo (${falha.tipo}):`, falha.msg);
                await msg.edit({ content: `${rotulo}\n🔄 Tentando compilar o Resumo Definitivo em ${espera}s... (tentativa ${tentativa})` }).catch(() => { });
                await new Promise(resolve => setTimeout(resolve, espera * 1000));
                tentativa++;
                continue;
            }

            // As páginas já existem: nada é perdido aqui, só avisamos.
            const aviso = falha.tipo === 'quota'
                ? `🛑 **Cota diária da IA esgotada.** Ela reseta em ~${horasAteViradaQuota()}h (meia-noite no fuso do Pacífico).`
                : falha.tipo === 'bloqueio'
                    ? '⚠️ **A IA bloqueou o conteúdo do Super Resumo.**'
                    : '❌ Erro ao gerar o Super Resumo. (Falha na IA)';
            console.error(`[RESUMO] Super resumo falhou (${falha.tipo}):`, falha.msg);
            await msg.edit({ content: `${aviso}\n📄 O resumo por blocos continua disponível abaixo.`, components: [montarBotoes(sessao)] }).catch(() => { });
            return;
        }
    }

    try {
        sessao.superJaGerado = true;
        sessao.paginas.push(montarSuperEmbed(parseAIJSON(bruto)));
        sessao.paginaAtual = sessao.paginas.length - 1;
        await msg.edit({
            content: '✨ **Compilado com sucesso!**',
            embeds: [sessao.paginas[sessao.paginaAtual]],
            components: [montarBotoes(sessao)],
        });
    } catch (err) {
        console.error('[RESUMO] Erro ao montar o Super Resumo:', err);
        await msg.edit({ content: '❌ Erro ao montar o Super Resumo. (Falha de leitura do JSON)', components: [montarBotoes(sessao)] }).catch(() => { });
    }
}

async function handleBotaoResumo(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;
    if (!BOTOES_SESSAO.has(interaction.customId)) return;

    const i = interaction as ButtonInteraction;
    const sessao = sessoes.get(i.message.id);

    // Restart do bot ou TTL vencido: avisa em vez de simplesmente não responder.
    if (!sessao) {
        await i.reply({
            content: '⌛ Este resumo não está mais na memória do bot (ele provavelmente reiniciou). Roda `rp!resumo` de novo.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => { });
        await i.message.edit({ components: [] }).catch(() => { });
        return;
    }

    if (i.user.id !== sessao.autorId) {
        await i.reply({ content: '❌ Apenas quem pediu o resumo pode usar os botões.', flags: MessageFlags.Ephemeral }).catch(() => { });
        return;
    }

    if (i.customId === 'resumo:prev' || i.customId === 'resumo:next') {
        const destino = sessao.paginaAtual + (i.customId === 'resumo:next' ? 1 : -1);
        sessao.paginaAtual = Math.max(0, Math.min(destino, sessao.paginas.length - 1));
        await i.update({ embeds: [sessao.paginas[sessao.paginaAtual]], components: [montarBotoes(sessao)] });
        return;
    }

    await gerarSuperResumo(i, sessao);
}

// ─── Auto-inscrição no EventCheckout ─────────────────────────────────────────
// Handler global de paginação: substitui o collector por sessão, que morria em
// 10 minutos. Ignora qualquer customId que não seja dos botões do resumo.
// (Os botões de confirmação de custo — `resumoConf:` — NÃO passam por aqui:
//  são efêmeros e resolvidos por awaitMessageComponent no modules/confirm.ts.)
EventCheckout.onInteractionCreate('resumo:paginacao', handleBotaoResumo);
