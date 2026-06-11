// RPTool/supercommands/help/views.ts
// ─── Renderizadores da Central de Ajuda ───────────────────────────────────────
// Cada "tela" da wiki (início, categoria, comando, busca) vira um par
// { embeds, components } pronto pra enviar/atualizar na mensagem.

import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from 'discord.js';
import {
    CATEGORIES,
    HelpCategory,
    HelpEntry,
    findCategory,
    findEntry,
    essentialEntries,
} from './registry';
import { searchHelp } from './search';

const COLOR = 0x0099FF;
const ENTRIES_PER_PAGE = 5;

export type HelpState =
    | { mode: 'home' }
    | { mode: 'category'; catId: string; page: number }
    | { mode: 'entry'; catId: string; entryId: string }
    | { mode: 'search'; query: string };

export interface HelpPayload {
    embeds:     EmbedBuilder[];
    components: ActionRowBuilder<any>[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Divide uma lista de linhas em blocos de até `max` chars (limite de field do Discord). */
function chunkLines(lines: string[], max = 1024): string[] {
    const chunks: string[] = [];
    let current = '';
    for (const line of lines) {
        if (current && current.length + line.length + 1 > max) {
            chunks.push(current);
            current = '';
        }
        current += (current ? '\n' : '') + line;
    }
    if (current) chunks.push(current);
    return chunks;
}

function categorySelectRow(currentCatId?: string): ActionRowBuilder<any> {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('help_cat')
        .setPlaceholder('📂 Navegar pelas categorias...');

    for (const cat of CATEGORIES) {
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(cat.label)
                .setValue(cat.id)
                .setDescription(cat.desc.substring(0, 100))
                .setEmoji(cat.emoji)
                .setDefault(cat.id === currentCatId),
        );
    }
    return new ActionRowBuilder<any>().addComponents(menu);
}

function commandSelectRow(cat: HelpCategory, currentEntryId?: string): ActionRowBuilder<any> {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('help_cmd')
        .setPlaceholder('📖 Ver detalhes de um comando...');

    for (const entry of cat.entries.slice(0, 25)) {
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(`rp!${entry.name}`.substring(0, 100))
                .setValue(`${cat.id}:${entry.id}`)
                .setDescription(entry.summary.substring(0, 100))
                .setEmoji(entry.emoji)
                .setDefault(entry.id === currentEntryId),
        );
    }
    return new ActionRowBuilder<any>().addComponents(menu);
}

function navRow(state: HelpState, totalPages = 1): ActionRowBuilder<any> {
    const page  = state.mode === 'category' ? state.page : 0;
    const paged = state.mode === 'category' && totalPages > 1;

    return new ActionRowBuilder<any>().addComponents(
        new ButtonBuilder().setCustomId('help_home').setLabel('🏠 Início').setStyle(ButtonStyle.Secondary).setDisabled(state.mode === 'home'),
        new ButtonBuilder().setCustomId('help_prev').setLabel('⬅️').setStyle(ButtonStyle.Primary).setDisabled(!paged || page === 0),
        new ButtonBuilder().setCustomId('help_next').setLabel('➡️').setStyle(ButtonStyle.Primary).setDisabled(!paged || page >= totalPages - 1),
        new ButtonBuilder().setCustomId('help_search').setLabel('🔍 Pesquisar').setStyle(ButtonStyle.Success),
    );
}

// ─── Telas ────────────────────────────────────────────────────────────────────

function renderHome(): HelpPayload {
    const essentials = essentialEntries()
        .map(({ entry }) => `${entry.emoji} \`rp!${entry.name}\` — ${entry.summary}`)
        .join('\n');

    const catList = CATEGORIES
        .map(c => `${c.emoji} **${c.label}** — ${c.desc} *(${c.entries.length})*`)
        .join('\n');

    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('📖 Central de Ajuda — RPTool')
        .setDescription(
            'Bem-vindo à wiki de comandos! Use o **menu abaixo** pra explorar uma categoria, ' +
            'ou o botão **🔍 Pesquisar** pra encontrar um comando ou termo específico.\n' +
            'Atalho: `rp!help [comando|categoria|termo]` pula direto pra página.',
        )
        .addFields(
            { name: '⚡ Comandos Essenciais', value: essentials },
            { name: '📂 Categorias', value: catList },
        )
        .setFooter({ text: `${CATEGORIES.reduce((n, c) => n + c.entries.length, 0)} comandos catalogados • menus expiram em 5 min` });

    return { embeds: [embed], components: [categorySelectRow(), navRow({ mode: 'home' })] };
}

function renderCategory(catId: string, page: number): HelpPayload {
    const cat = findCategory(catId);
    if (!cat) return renderHome();

    const totalPages = Math.max(1, Math.ceil(cat.entries.length / ENTRIES_PER_PAGE));
    const safePage   = Math.min(Math.max(page, 0), totalPages - 1);
    const visible    = cat.entries.slice(safePage * ENTRIES_PER_PAGE, (safePage + 1) * ENTRIES_PER_PAGE);

    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`${cat.emoji} ${cat.label}`)
        .setDescription(`${cat.desc}.\n*Selecione um comando no segundo menu pra ver uso detalhado, subcomandos e exemplos.*`)
        .setFooter({ text: `Página ${safePage + 1} de ${totalPages} • ${cat.entries.length} comandos nesta categoria` });

    for (const entry of visible) {
        const adminTag = entry.admin ? ' `[ADMIN]`' : '';
        const subCount = entry.subs?.length ? ` • ${entry.subs.length} subcomandos` : '';
        embed.addFields({
            name:  `${entry.emoji} rp!${entry.name}${adminTag}`,
            value: `${entry.summary}\n\`${entry.usage[0]}\`${subCount}`,
        });
    }

    return {
        embeds: [embed],
        components: [
            categorySelectRow(cat.id),
            commandSelectRow(cat),
            navRow({ mode: 'category', catId, page: safePage }, totalPages),
        ],
    };
}

function renderEntry(catId: string, entryId: string): HelpPayload {
    const found = findEntry(catId, entryId);
    if (!found) return renderHome();
    const { cat, entry } = found;

    let desc = `**${entry.summary}**`;
    if (entry.admin)   desc += '\n🛡️ *Requer permissão de administrador/staff.*';
    if (entry.details) desc += `\n\n${entry.details}`;

    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`${entry.emoji} rp!${entry.name}`)
        .setDescription(desc)
        .addFields({ name: '📌 Como usar', value: entry.usage.map(u => `\`${u}\``).join('\n') })
        .setFooter({ text: `${cat.emoji} ${cat.label} • 🏠 Início volta pro menu principal` });

    if (entry.subs?.length) {
        const lines  = entry.subs.map(s => `\`${s.usage}\`\n└ ${s.desc}`);
        const chunks = chunkLines(lines);
        chunks.forEach((chunk, i) => {
            embed.addFields({ name: i === 0 ? '🧩 Subcomandos' : '🧩 Subcomandos (cont.)', value: chunk });
        });
    }

    if (entry.aliases?.length) {
        embed.addFields({ name: '🔁 Apelidos', value: entry.aliases.map(a => `\`rp!${a}\``).join(' • ') });
    }

    return {
        embeds: [embed],
        components: [
            categorySelectRow(cat.id),
            commandSelectRow(cat, entry.id),
            navRow({ mode: 'entry', catId, entryId }),
        ],
    };
}

function renderSearch(query: string): HelpPayload {
    const results = searchHelp(query);

    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`🔍 Pesquisa: "${query.substring(0, 100)}"`);

    const components: ActionRowBuilder<any>[] = [categorySelectRow()];

    if (results.length === 0) {
        embed.setDescription(
            'Nenhum comando encontrado. 😕\n' +
            'Tente outro termo (ex: `relógio`, `banir`, `personagem`) ou navegue pelas categorias abaixo.',
        );
    } else {
        embed.setDescription(
            results
                .map(r => `${r.entry.emoji} **rp!${r.entry.name}** — ${r.entry.summary}\n└ *${r.cat.emoji} ${r.cat.label}*`)
                .join('\n'),
        );
        embed.setFooter({ text: `${results.length} resultado(s) • selecione um pra ver os detalhes` });

        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_cmd')
            .setPlaceholder('📖 Abrir um resultado...');
        for (const r of results.slice(0, 25)) {
            menu.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`rp!${r.entry.name}`.substring(0, 100))
                    .setValue(`${r.cat.id}:${r.entry.id}`)
                    .setDescription(r.entry.summary.substring(0, 100))
                    .setEmoji(r.entry.emoji),
            );
        }
        components.push(new ActionRowBuilder<any>().addComponents(menu));
    }

    components.push(navRow({ mode: 'search', query }));
    return { embeds: [embed], components };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export function render(state: HelpState): HelpPayload {
    switch (state.mode) {
        case 'category': return renderCategory(state.catId, state.page);
        case 'entry':    return renderEntry(state.catId, state.entryId);
        case 'search':   return renderSearch(state.query);
        default:         return renderHome();
    }
}
