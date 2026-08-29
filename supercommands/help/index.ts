// RPTool/supercommands/help/index.ts
// ─── Central de Ajuda Interativa (wiki de comandos) ───────────────────────────
//
// Arquitetura:
//   registry.ts → conteúdo (categorias, comandos, subcomandos, keywords)
//   search.ts   → busca com normalização de acentos e scoring
//   views.ts    → renderizadores de cada tela (home, categoria, comando, busca)
//   index.ts    → roteamento + collector de botões/menus + modal de pesquisa
//
// Para adicionar um comando novo ao help, edite SOMENTE o registry.ts.
//
// Navegação:
//   rp!help               → página inicial (essenciais + categorias)
//   rp!help <comando>     → detalhes do comando (ex: rp!help oc wiki)
//   rp!help <categoria>   → abre a categoria (ex: rp!help moderação)
//   rp!help <termo>       → pesquisa (ex: rp!help relógio)
//   Botão 🔍              → modal de pesquisa na própria mensagem

import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Message,
    ButtonInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder, MessageFlags } from 'discord.js';
import { CATEGORIES } from './registry';
import { normalize } from './search';
import { render, HelpState } from './views';

const COLLECTOR_TIME = 5 * 60 * 1000; // 5 min, igual à wiki de OC

// ─── Resolve o argumento de rp!help <algo> pra uma tela inicial ───────────────
function resolveInitialState(query: string): HelpState {
    const q = normalize(query);
    if (!q) return { mode: 'home' };

    // 1. Comando exato (nome ou alias)
    for (const cat of CATEGORIES) {
        for (const entry of cat.entries) {
            if (normalize(entry.name) === q || entry.aliases?.some(a => normalize(a) === q)) {
                return { mode: 'entry', catId: cat.id, entryId: entry.id };
            }
        }
    }

    // 2. Categoria (id ou nome)
    for (const cat of CATEGORIES) {
        if (cat.id === q || normalize(cat.label).includes(q)) {
            return { mode: 'category', catId: cat.id, page: 0 };
        }
    }

    // 3. Caiu na pesquisa
    return { mode: 'search', query };
}

// ─── Fluxo principal ──────────────────────────────────────────────────────────
async function runHelp(target: Message | ChatInputCommandInteraction, isSlash: boolean, query: string) {
    let state = resolveInitialState(query);

    const ownerId = isSlash
        ? (target as ChatInputCommandInteraction).user.id
        : (target as Message).author.id;

    let sent: Message;
    if (isSlash) sent = await (target as ChatInputCommandInteraction).reply(render(state)).then(() => (target as ChatInputCommandInteraction).fetchReply());
    else         sent = await (target as Message).reply(render(state));

    const collector = sent.createMessageComponentCollector({ time: COLLECTOR_TIME });

    collector.on('collect', async (i) => {
        if (i.user.id !== ownerId) {
            return i.reply({ content: '❌ Ei! Esse menu pertence a outra pessoa. Use `rp!help` para abrir o seu.', flags: MessageFlags.Ephemeral });
        }

        try {
            if (i.isStringSelectMenu()) {
                if (i.customId === 'help_cat') {
                    state = { mode: 'category', catId: i.values[0], page: 0 };
                } else if (i.customId === 'help_cmd') {
                    const [catId, entryId] = i.values[0].split(':');
                    state = { mode: 'entry', catId, entryId };
                }
                return await i.update(render(state));
            }

            if (i.isButton()) {
                switch (i.customId) {
                    case 'help_home':
                        state = { mode: 'home' };
                        return await i.update(render(state));

                    case 'help_prev':
                    case 'help_next':
                        if (state.mode === 'category') {
                            state.page += i.customId === 'help_next' ? 1 : -1;
                        }
                        return await i.update(render(state));

                    case 'help_search':
                        return await openSearchModal(i);
                }
            }
        } catch (e) {
            console.error('[Help] Erro ao processar interação:', e);
        }
    });

    collector.on('end', () => {
        sent.edit({ components: [] }).catch(() => {});
    });

    // ─── Modal de pesquisa (botão 🔍) ─────────────────────────────────────────
    async function openSearchModal(i: ButtonInteraction) {
        const modalId = `help_modal_${i.id}`;
        const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle('🔍 Pesquisar na Central de Ajuda')
            .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId('help_query')
                        .setLabel('Comando ou termo')
                        .setPlaceholder('Ex: wiki, banir, relógio, personagem...')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(100),
                ),
            );

        await i.showModal(modal);

        const submit = await i
            .awaitModalSubmit({
                time: 60_000,
                filter: m => m.customId === modalId && m.user.id === ownerId,
            })
            .catch(() => null);
        if (!submit) return;

        state = { mode: 'search', query: submit.fields.getTextInputValue('help_query') };
        await submit.deferUpdate();
        await sent.edit(render(state)).catch(() => {});
    }
}

// ─── Exportação do SuperComando ───────────────────────────────────────────────
export default {
    name:        'help',
    description: 'Central de Ajuda interativa do RPTool (wiki de comandos)',
    aliases:     ['ajuda', 'comandos'],

    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra a Central de Ajuda interativa')
        .addStringOption(o => o
            .setName('busca')
            .setDescription('Comando, categoria ou termo pra pular direto')
            .setRequired(false),
        ),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const query = interaction.options.getString('busca') ?? '';
        await runHelp(interaction, true, query);
    },

    async execute(message: Message, args: string[]) {
        await runHelp(message, false, args.join(' '));
    },
};
