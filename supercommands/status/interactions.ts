// RPTool/supercommands/status/interactions.ts
// ─── Rankings interativos do status ───────────────────────────────────────────
// Roteado pelo interactionCheckout via prefixo de customId `stats_`.
// Formato dos customId: `stats_<tipo>:<page>:<uid>`  (uid = dono do painel, sempre o último segmento)
//   • stats_users / stats_chats / stats_ocs : ranking paginado (14 dias)
//   • stats_day:<uid>                        : abre o modal de data
//   • stats_daymodal:<uid>                   : submit do modal
//   • stats_dayres:<dataISO>:<page>:<uid>    : ranking de um dia específico
import {
    Interaction, ButtonInteraction, ModalSubmitInteraction, Guild,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import ServerStats from '../../tools/models/ServerStats';
import { LOOKBACK_DAYS } from './index';
import { handleExploreInteraction } from './handlers/explore';
import { handleTrendingInteraction } from './handlers/trending';

const PER_PAGE = 10;

const TYPE_META: Record<string, { title: string; field: string; render: (k: string) => string }> = {
    users: { title: '👥 Ranking de Usuários', field: 'users',    render: (k) => `<@${k}>` },
    chats: { title: '💬 Ranking de Canais',   field: 'channels', render: (k) => `<#${k}>` },
    ocs:   { title: '🎭 Ranking de OCs',       field: 'ocs',      render: (k) => `🎭 **${escapeMd(k)}**` },
};

// ─── Helpers de dados ─────────────────────────────────────────────────────────
function getLookbackDates(): string[] {
    const now = new Date();
    return Array.from({ length: LOOKBACK_DAYS }, (_, i) => {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        return d.toISOString().split('T')[0];
    });
}

function aggregate(stats: any[], field: string): [string, number][] {
    const totals: Record<string, number> = {};
    for (const s of stats) {
        const map = s[field];
        if (!map || typeof map.entries !== 'function') continue;
        for (const [k, v] of map.entries()) {
            // No ranking de usuários, descarta chaves não-numéricas (ex: _id de OC legado)
            if (field === 'users' && !/^\d{17,20}$/.test(k)) continue;
            totals[k] = (totals[k] || 0) + v;
        }
    }
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

function escapeMd(s: string): string {
    return (s || '').replace(/([*_`~|\\])/g, '\\$1');
}

function parseDate(input: string): string | null {
    const m = (input || '').trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (!m) return null;
    const day = +m[1], month = +m[2], year = m[3] ? +m[3] : new Date().getUTCFullYear();
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
    return d.toISOString().split('T')[0];
}

function formatBR(iso: string): string {
    const [y, mo, da] = iso.split('-');
    return `${da}/${mo}/${y}`;
}

// ─── Componentes ──────────────────────────────────────────────────────────────
// Os botões de troca usam o marcador `:r:` (reset → página 1) em vez de `:1:`.
// Isso evita colisão de customId com o botão "◀ anterior" da pageRow quando se
// está na página 2 (que geraria `stats_<tipo>:1:<uid>`, idêntico ao de troca).
// O roteador resolve `r` como página 1 (parseInt('r') || 1).
function switchRow(uid: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`stats_users:r:${uid}`).setLabel('Users').setEmoji('👥').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`stats_chats:r:${uid}`).setLabel('Chats').setEmoji('💬').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`stats_ocs:r:${uid}`).setLabel('OCs').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`stats_day:${uid}`).setLabel('Dia').setEmoji('📅').setStyle(ButtonStyle.Primary),
    );
}

function pageRow(prefix: string, page: number, totalPages: number, uid: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${prefix}:${page - 1}:${uid}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
        new ButtonBuilder().setCustomId(`stats_noop:${uid}`).setLabel(`Página ${page}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`${prefix}:${page + 1}:${uid}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages),
    );
}

function rankEmbed(title: string, subtitle: string, sorted: [string, number][], page: number, render: (k: string) => string) {
    const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
    const p = Math.min(Math.max(1, page), totalPages);
    const slice = sorted.slice((p - 1) * PER_PAGE, p * PER_PAGE);

    const lines = slice.map(([k, c], i) =>
        `**${(p - 1) * PER_PAGE + i + 1}.** ${render(k)} — \`${c.toLocaleString('pt-BR')}\` msgs`);
    const desc = lines.length ? lines.join('\n') : '📉 Nenhum dado registrado para este período.';

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(title)
        .setDescription(`${subtitle}\n\n${desc}`)
        .setFooter({ text: `RPTool | Status • ${sorted.length} no ranking` });

    return { embed, totalPages, p };
}

// ─── Renderizadores ───────────────────────────────────────────────────────────
async function renderRanking(interaction: ButtonInteraction, type: string, page: number, uid: string) {
    const dates = getLookbackDates();
    const stats = await ServerStats.find({ guildId: (interaction.guild as Guild).id, date: { $in: dates } });
    const meta = TYPE_META[type];

    const sorted = aggregate(stats, meta.field);
    const { embed, totalPages, p } = rankEmbed(meta.title, `Atividade dos últimos **${LOOKBACK_DAYS} dias**.`, sorted, page, meta.render);

    await interaction.update({
        embeds: [embed],
        files: [],
        components: [pageRow(`stats_${type}`, p, totalPages, uid), switchRow(uid)],
    });
}

async function renderDay(interaction: ButtonInteraction | ModalSubmitInteraction, iso: string, page: number, uid: string) {
    const stats = await ServerStats.find({ guildId: (interaction.guild as Guild).id, date: iso });
    const sorted = aggregate(stats, 'users');
    const { embed, totalPages, p } = rankEmbed(
        `📅 Ranking do Dia — ${formatBR(iso)}`,
        `Quem mais falou em **${formatBR(iso)}**.`,
        sorted, page, TYPE_META.users.render,
    );

    await (interaction as any).update({
        embeds: [embed],
        files: [],
        components: [pageRow(`stats_dayres:${iso}`, p, totalPages, uid), switchRow(uid)],
    });
}

async function openDayModal(interaction: ButtonInteraction, uid: string) {
    const modal = new ModalBuilder().setCustomId(`stats_daymodal:${uid}`).setTitle('Ranking por Dia');
    const input = new TextInputBuilder()
        .setCustomId('data')
        .setLabel('Data (DD/MM ou DD/MM/AAAA)')
        .setPlaceholder('15/06   ou   15/06/2026')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
}

// ─── Roteador ─────────────────────────────────────────────────────────────────
export async function handleStatusInteraction(interaction: Interaction): Promise<void> {
    // Explorador e Trending têm os próprios roteadores
    if ((interaction as any).customId?.startsWith('stats_exp')) {
        return handleExploreInteraction(interaction);
    }
    if ((interaction as any).customId?.startsWith('stats_trend')) {
        return handleTrendingInteraction(interaction);
    }
    try {
        if (interaction.isButton()) {
            const id = interaction.customId;
            const uid = id.split(':').pop() as string;

            if (id.startsWith('stats_noop')) { await interaction.deferUpdate().catch(() => {}); return; }

            // Painel público: qualquer um pode navegar.
            if (id.startsWith('stats_day:'))     return await openDayModal(interaction, uid);

            if (id.startsWith('stats_dayres:')) {
                const parts = id.split(':');           // ['stats_dayres', iso, page, uid]
                return await renderDay(interaction, parts[1], parseInt(parts[2], 10) || 1, uid);
            }

            const parts = id.split(':');               // ['stats_<type>', page, uid]
            const type = parts[0].replace('stats_', '');
            if (TYPE_META[type]) return await renderRanking(interaction, type, parseInt(parts[1], 10) || 1, uid);
            return;
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('stats_daymodal:')) {
            const uid = interaction.customId.split(':').pop() as string;
            const iso = parseDate(interaction.fields.getTextInputValue('data'));
            if (!iso) {
                await interaction.reply({ content: '❌ Data inválida. Use `DD/MM` ou `DD/MM/AAAA` (ex: `15/06` ou `15/06/2026`).', ephemeral: true });
                return;
            }
            return await renderDay(interaction, iso, 1, uid);
        }
    } catch (e) {
        console.error('[Status] Erro na interação de ranking:', e);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '🚨 Erro ao montar o ranking.', ephemeral: true }).catch(() => {});
        }
    }
}
