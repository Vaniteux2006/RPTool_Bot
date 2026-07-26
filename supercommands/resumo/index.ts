// RPTool/supercommands/resumo/index.ts
// ─── Resumo de RP por IA ─────────────────────────────────────────────────────
//
// Pipeline (uma execução = 1 requisição de IA no caso comum):
//   1. parseArgs   → canal (#menção), intervalo de datas, flag -y, `help`
//   2. collector   → fetch até 1200 msgs do intervalo → fatia por CARACTERES
//   3. confirm     → só se o fatiamento gerou 2+ blocos (2+ requisições)
//   4. pipeline    → 1 requisição por bloco, retry infinito só p/ 503/rate limit
//   5. pages       → Tópicos → Ações → Linha do Tempo, dentro dos limites do embed
//   6. interactions→ sessão em memória (TTL 6h) com paginação + Resumo Definitivo
//
// Princípios que explicam quase todas as decisões daqui:
//   • "Manda e esquece": o usuário dispara e volta depois. Nada pode depender de
//     um clique em janela curta (daí a sessão em Map, não collector).
//   • Cota da IA é o recurso escasso, não CPU/RAM: fatiar por caracteres, avisar
//     o custo antes, e NUNCA descartar bloco já processado por causa de falha
//     posterior (entrega parcial > erro seco).
//
// Estado: só o Map de sessões (interactions.ts). Sem Mongo, sem disco.

import { Message } from 'discord.js';
import { getGuildAIConfig } from '../../tools/utils/tokenHelper';
import { MAX_MENSAGENS } from './config';
import { coletarMensagens, montarBlocos } from './modules/collector';
import { confirmarCusto } from './modules/confirm';
import { descreverErroFatal } from './modules/errors';
import { montarPaginas } from './modules/pages';
import { parseArgs } from './modules/parseArgs';
import { processarBlocos } from './modules/pipeline';
import { criarSessao, montarBotoes } from './interactions';

export default {
    name: 'resumo',
    description: 'Cria resumos em blocos categorizados de longos períodos de RP.',
    aliases: ['resume', 'recap'],

    async execute(message: Message, args: string[]) {
        const opcoes = parseArgs(message, args);

        if (opcoes.ajuda) return sendHelp(message);
        if (opcoes.erro) return message.reply(opcoes.erro);

        // A chave de IA é resolvida por SERVIDOR (`rp!token` → assignments). Em DM
        // não há servidor: cair no fallback do .env deixaria qualquer um queimar a
        // cota global do dono do bot, então o comando simplesmente não roda em DM.
        if (!message.guild) {
            return message.reply('❌ Este comando só funciona em servidores — a chave de IA usada é a do servidor (`rp!token`).');
        }

        const aiConfig = await getGuildAIConfig(message.guild.id);
        if (!aiConfig) return message.reply('❌ **Erro:** Nenhuma IA está configurada para este servidor.');

        const loadMsg = await message.reply(`⏳ **Puxando os arquivos da Akáshica...**`);

        try {
            // ── 1. Coleta ─────────────────────────────────────────────────────
            const { mensagens, atingiuTeto } = await coletarMensagens(opcoes.canal, opcoes.inicio, opcoes.fim);
            if (mensagens.length === 0) {
                return loadMsg.edit('📭 Nenhuma mensagem válida de RP encontrada neste período.');
            }

            // ── 2. Fatiamento ─────────────────────────────────────────────────
            const { chunks, logs, blocoUnico } = montarBlocos(mensagens);

            // ── 3. Confirmação de custo (só quando custa mais de 1 requisição) ─
            if (!blocoUnico && !opcoes.pularConfirmacao) {
                const seguir = await confirmarCusto(loadMsg, message.author.id, mensagens.length, chunks.length);
                if (!seguir) return;
            }

            // ── 4. Requisições à IA ───────────────────────────────────────────
            const { resumos, interrompido } = await processarBlocos(loadMsg, logs, blocoUnico, aiConfig, mensagens.length);

            // Só é erro de verdade se nem um bloco saiu. Com qualquer bloco pronto,
            // entregamos o parcial em vez de jogar a requisição paga fora.
            if (resumos.length === 0) {
                return loadMsg.edit(interrompido
                    ? `${interrompido.titulo}\n${interrompido.detalhe}`
                    : '❌ A IA não retornou nada utilizável.');
            }

            // ── 5. Páginas ────────────────────────────────────────────────────
            await loadMsg.edit('✨ **Organizando as páginas...**');
            const paginas = montarPaginas(resumos, chunks);

            const avisoTeto = atingiuTeto
                ? `\n⚠️ O período pedido tem mais de ${MAX_MENSAGENS} mensagens — resumi apenas as ${MAX_MENSAGENS} mais recentes dele.`
                : '';

            const avisoParcial = interrompido
                ? `\n${interrompido.titulo} ${interrompido.detalhe}` +
                  `\n📄 **Resumo parcial:** ${resumos.length} de ${chunks.length} blocos — o que já tinha sido processado está aqui.`
                : '';

            const cabecalho = interrompido ? '⚠️ **Análise interrompida.**' : '✅ **Análise Completa!**';

            // ── 6. Sessão de paginação ────────────────────────────────────────
            const sessao = criarSessao({
                mensagem: loadMsg,
                autorId: message.author.id,
                guildId: message.guild.id,
                paginas,
                resumos,
                blocoUnico,
                interrompido,
            });

            await loadMsg.edit({
                content: `${cabecalho}${avisoParcial}${avisoTeto}`,
                embeds: [paginas[0]],
                components: [montarBotoes(sessao)],
            });

        } catch (error: any) {
            console.error('[RESUMO] Erro fatal:', error);
            await loadMsg.edit(descreverErroFatal(error));
        }
    },
};

function sendHelp(message: Message) {
    return message.reply(
        `📜 **Resumo de RP por IA**\n\n` +

        `**🔹 Uso básico**\n` +
        `\`rp!resumo\` — últimas 3 horas do canal atual\n` +
        `\`rp!resumo #canal\` — mesma janela, em outro canal\n\n` +

        `**🔹 Por período**\n` +
        `\`rp!resumo DD/MM\` — o dia inteiro (ano atual)\n` +
        `\`rp!resumo DD/MM/AAAA -> DD/MM/AAAA\` — intervalo\n` +
        `\`rp!resumo DD/MM HH:MM -> DD/MM HH:MM\` — intervalo com hora\n\n` +

        `**🔹 Flags**\n` +
        `\`-y\` — pula a confirmação de custo (ex: \`rp!resumo 15/03 -> 20/03 -y\`)\n\n` +

        `**🔹 O que você recebe**\n` +
        `Páginas navegáveis: 📌 Tópicos · 👥 Ações e Participantes · 📜 Linha do Tempo.\n` +
        `O botão 🌟 **Resumo Definitivo** junta tudo numa narrativa só.\n\n` +

        `-# Lê no máximo ${MAX_MENSAGENS} mensagens por execução e usa a chave de IA do servidor (\`rp!token\`). ` +
        `Períodos grandes viram 2+ requisições — aí o bot pergunta antes. Os botões duram 6h ou até o bot reiniciar.`,
    );
}
