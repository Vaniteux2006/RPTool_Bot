// RPTool/supercommands/status/handlers/explore.ts
// ─── rp!status explorar — Explorador interativo (período × dimensão) ───────────
// Painel com botões: escolhe período (Tudo / ano / 30d / custom) e dimensão
// (linha do tempo, top users/canais/palavras/OCs), além de tendência de termos
// (Ngram) e alvo (@user/#canal). Toda agregação roda no banco (pipeline).
//
// customId: `stats_exp:<from>:<to>:<view>:<arg>:<uid>`  (from/to = 'all' ou YYYY-MM-DD)
//   view ∈ timeline|users|channels|words|ocs|term|target ; arg = page|termos|field|key|'_'
import {
    Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, Client, Guild,
} from 'discord.js';
import {
    aggTimeline, aggTop, aggTopCount, aggKeyTimeline, lineChartMulti,
    presetRange, periodLabel, formatPeriodPoint, fmt, StatField,
} from './aggregate';

interface State { from: string | null; to: string | null; view: string; arg: string; uid: string; }

const DIMS: [string, string, string][] = [
    ['timeline', 'Linha', '📈'], ['users', 'Users', '👥'],
    ['channels', 'Canais', '💬'], ['words', 'Palavras', '📝'], ['ocs', 'OCs', '🎭'],
];
const TITLES: Record<string, string> = {
    timeline: '📈 Linha do Tempo', users: '👥 Top Usuários', channels: '💬 Top Canais',
    words: '📝 Top Palavras', ocs: '🎭 Top OCs', term: '🔤 Tendência de Termos', target: '🎯 Alvo',
};

const sg = (s: string | null) => s ?? 'all';
const ag = (s: string) => s || '_';
function parseState(id: string): State {
    const p = id.split(':'); // stats_exp:from:to:view:arg:uid
    return { from: p[1] === 'all' ? null : p[1], to: p[2] === 'all' ? null : p[2], view: p[3], arg: p[4] === '_' ? '' : p[4], uid: p[5] };
}
function parseBRDate(s: string): string | null {
    const m = (s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}
const renderKey = (view: string, k: string) =>
    view === 'users' ? `<@${k}>` : view === 'channels' ? `<#${k}>` : view === 'ocs' ? `🎭 **${k}**` : `\`${k}\``;

// ─── Componentes ──────────────────────────────────────────────────────────────
function periodRow(s: State): ActionRowBuilder<ButtonBuilder> {
    const mk = (label: string, emoji: string, preset: string) => {
        const { from, to } = presetRange(preset);
        return new ButtonBuilder()
            .setCustomId(`stats_exp:${sg(from)}:${sg(to)}:${s.view}:${ag(s.arg)}:${s.uid}`)
            .setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Secondary);
    };
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        mk('Tudo', '🌐', 'all'), mk('Este ano', '📅', 'year'), mk('Ano passado', '🗓️', 'lastyear'), mk('30 dias', '⏱️', '30d'),
        new ButtonBuilder().setCustomId(`stats_expcustom:${s.view}:${ag(s.arg)}:${s.uid}`).setLabel('Custom').setEmoji('🔧').setStyle(ButtonStyle.Secondary),
    );
}
function dimRow(s: State): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        DIMS.map(([v, label, emoji]) =>
            new ButtonBuilder()
                .setCustomId(`stats_exp:${sg(s.from)}:${sg(s.to)}:${v}:${v === 'timeline' ? '_' : '1'}:${s.uid}`)
                .setLabel(label).setEmoji(emoji).setStyle(s.view === v ? ButtonStyle.Primary : ButtonStyle.Secondary)),
    );
}
function pageRow(s: State, totalPages: number): ActionRowBuilder<ButtonBuilder> {
    const page = Math.max(1, parseInt(s.arg) || 1);
    const nav = (p: number, emoji: string, disabled: boolean) =>
        new ButtonBuilder().setCustomId(`stats_exp:${sg(s.from)}:${sg(s.to)}:${s.view}:${p}:${s.uid}`).setEmoji(emoji).setStyle(ButtonStyle.Secondary).setDisabled(disabled);
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        nav(page - 1, '◀️', page <= 1),
        new ButtonBuilder().setCustomId(`stats_expnoop:${s.uid}`).setLabel(`Página ${page}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        nav(page + 1, '▶️', page >= totalPages),
    );
}
function actionRow(s: State): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`stats_expterm:${sg(s.from)}:${sg(s.to)}:${s.uid}`).setLabel('Termos (Ngram)').setEmoji('🔤').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`stats_exptarget:${sg(s.from)}:${sg(s.to)}:${s.uid}`).setLabel('Alvo').setEmoji('🎯').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`stats_trend:7d:now:${s.uid}`).setLabel('Em Alta').setEmoji('🔥').setStyle(ButtonStyle.Secondary),
    );
}

// ─── Monta o payload do painel para um estado ─────────────────────────────────
export async function buildExplorePayload(client: Client, guild: Guild, s: State): Promise<any> {
    const guildId = guild.id;
    const periodo = periodLabel(s.from, s.to);
    const base = () => new EmbedBuilder().setColor(0x5865F2).setTitle(`${TITLES[s.view] ?? '🔎 Explorar'} · ${guild.name}`);
    let embed: EmbedBuilder; const files: any[] = []; const extra: ActionRowBuilder<ButtonBuilder>[] = [];

    if (['users', 'channels', 'words', 'ocs'].includes(s.view)) {
        const field = s.view as StatField;
        const page = Math.max(1, parseInt(s.arg) || 1);
        const count = await aggTopCount(guildId, s.from, s.to, field);
        const totalPages = Math.max(1, Math.ceil(count / 10));
        const top = await aggTop(guildId, s.from, s.to, field, (page - 1) * 10, 10);
        const lines = top.map(([k, v], i) => `**${(page - 1) * 10 + i + 1}.** ${renderKey(s.view, k)} — \`${fmt(v)}\``).join('\n') || '_sem dados no período_';
        embed = base().setDescription(`📆 **${periodo}**\n\n${lines}`).setFooter({ text: `${count} no total` });
        extra.push(pageRow(s, totalPages));

    } else if (s.view === 'term') {
        const terms = s.arg.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length >= 2).slice(0, 3);
        const seriesList = await Promise.all(terms.map(t => aggKeyTimeline(guildId, s.from, s.to, 'words', t)));
        const periods = Array.from(new Set(seriesList.flat().map(p => p.period))).sort();
        const datasets = terms.map((t, i) => ({ label: t, data: periods.map(per => seriesList[i].find(p => p.period === per)?.total || 0) }));
        files.push(await lineChartMulti(periods.map(formatPeriodPoint), datasets, 'explore.png'));
        const totals = terms.map((t, i) => `\`${t}\`: **${fmt(seriesList[i].reduce((a, b) => a + b.total, 0))}**`).join(' · ');
        embed = base().setDescription(`📆 **${periodo}**\n${totals || '_nenhum termo_'}`).setImage('attachment://explore.png');

    } else if (s.view === 'target') {
        const [field, key] = s.arg.split('|') as [StatField, string];
        const series = await aggKeyTimeline(guildId, s.from, s.to, field, key);
        files.push(await lineChartMulti(series.map(p => formatPeriodPoint(p.period)), [{ label: field === 'users' ? 'usuário' : 'canal', data: series.map(p => p.total) }], 'explore.png'));
        const total = series.reduce((a, b) => a + b.total, 0);
        const alvo = field === 'users' ? `<@${key}>` : `<#${key}>`;
        embed = base().setDescription(`Atividade de ${alvo} · 📆 **${periodo}**\nTotal: \`${fmt(total)}\` mensagens`).setImage('attachment://explore.png');

    } else { // timeline
        const series = await aggTimeline(guildId, s.from, s.to);
        const total = series.reduce((a, b) => a + b.total, 0);
        files.push(await lineChartMulti(series.map(p => formatPeriodPoint(p.period)), [{ label: 'Mensagens', data: series.map(p => p.total) }], 'explore.png'));
        embed = base().setDescription(`📆 **${periodo}**\nTotal: \`${fmt(total)}\` mensagens`).setImage('attachment://explore.png');
    }

    embed.setFooter({ text: `${embed.data.footer?.text ? embed.data.footer.text + ' • ' : ''}RPTool | Explorar` });
    return { content: null, embeds: [embed], files, components: [periodRow(s), dimRow(s), ...extra, actionRow(s)] };
}

// ─── Comando: rp!status explorar ──────────────────────────────────────────────
export async function handleExplore(message: Message, _args: string[]): Promise<any> {
    const s: State = { from: null, to: null, view: 'timeline', arg: '', uid: message.author.id };
    const payload = await buildExplorePayload(message.client, message.guild as Guild, s);
    return message.reply(payload);
}

// ─── Roteador das interações stats_exp* ───────────────────────────────────────
export async function handleExploreInteraction(interaction: any): Promise<void> {
    const id: string = interaction.customId;
    const uid = id.split(':').pop();
    if (interaction.user.id !== uid) { await interaction.reply({ content: '🔒 Esse painel não é seu.' }).catch(() => {}); return; }

    try {
        // ── Botões que abrem modal ──
        if (interaction.isButton() && id.startsWith('stats_expcustom:')) {
            const [, view, arg] = id.split(':');
            const modal = new ModalBuilder().setCustomId(`stats_expcustommod:${view}:${arg}:${uid}`).setTitle('Período personalizado');
            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('de').setLabel('De (DD/MM/AAAA)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)),
                new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('ate').setLabel('Até (DD/MM/AAAA)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)),
            );
            return await interaction.showModal(modal);
        }
        if (interaction.isButton() && id.startsWith('stats_expterm:')) {
            const [, from, to] = id.split(':');
            const modal = new ModalBuilder().setCustomId(`stats_exptermmod:${from}:${to}:${uid}`).setTitle('Tendência de termos');
            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder().setCustomId('termos').setLabel('1 a 3 palavras (separadas por vírgula)').setPlaceholder('amor, ódio, paz').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60)));
            return await interaction.showModal(modal);
        }
        if (interaction.isButton() && id.startsWith('stats_exptarget:')) {
            const [, from, to] = id.split(':');
            const modal = new ModalBuilder().setCustomId(`stats_exptargetmod:${from}:${to}:${uid}`).setTitle('Alvo específico');
            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder().setCustomId('alvo').setLabel('@usuário ou #canal (ou o ID)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40)));
            return await interaction.showModal(modal);
        }
        if (interaction.isButton() && id.startsWith('stats_expnoop')) { await interaction.deferUpdate().catch(() => {}); return; }

        // ── Navegação normal (período/dimensão/paginação) ──
        if (interaction.isButton() && id.startsWith('stats_exp:')) {
            await interaction.deferUpdate();
            const payload = await buildExplorePayload(interaction.client, interaction.guild, parseState(id));
            return await interaction.editReply(payload);
        }

        // ── Submits de modal ──
        if (interaction.isModalSubmit() && id.startsWith('stats_expcustommod:')) {
            const [, view, arg] = id.split(':');
            const from = parseBRDate(interaction.fields.getTextInputValue('de'));
            const to = parseBRDate(interaction.fields.getTextInputValue('ate'));
            if (!from || !to) { await interaction.reply({ content: '❌ Datas inválidas. Use `DD/MM/AAAA`.' }).catch(() => {}); return; }
            await interaction.deferUpdate();
            const payload = await buildExplorePayload(interaction.client, interaction.guild, { from, to, view, arg: arg === '_' ? '' : arg, uid });
            return await interaction.editReply(payload);
        }
        if (interaction.isModalSubmit() && id.startsWith('stats_exptermmod:')) {
            const [, from, to] = id.split(':');
            const termos = interaction.fields.getTextInputValue('termos').split(',').map((t: string) => t.trim()).filter(Boolean).slice(0, 3).join(',');
            await interaction.deferUpdate();
            const payload = await buildExplorePayload(interaction.client, interaction.guild, { from: from === 'all' ? null : from, to: to === 'all' ? null : to, view: 'term', arg: termos, uid });
            return await interaction.editReply(payload);
        }
        if (interaction.isModalSubmit() && id.startsWith('stats_exptargetmod:')) {
            const [, from, to] = id.split(':');
            const raw = interaction.fields.getTextInputValue('alvo').trim();
            let arg = '';
            const ch = raw.match(/^<#(\d+)>$/); const us = raw.match(/^<@!?(\d+)>$/);
            if (ch) arg = `channels|${ch[1]}`;
            else if (us) arg = `users|${us[1]}`;
            else if (/^\d{17,20}$/.test(raw)) arg = `users|${raw}`;
            if (!arg) { await interaction.reply({ content: '❌ Use uma menção `@usuário` / `#canal` ou um ID.' }).catch(() => {}); return; }
            await interaction.deferUpdate();
            const payload = await buildExplorePayload(interaction.client, interaction.guild, { from: from === 'all' ? null : from, to: to === 'all' ? null : to, view: 'target', arg, uid });
            return await interaction.editReply(payload);
        }
    } catch (e) {
        console.error('[Status] Erro no explorador:', e);
        if (interaction.isRepliable?.() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '🚨 Erro ao montar o explorador.' }).catch(() => {});
        } else {
            await interaction.editReply?.({ content: '🚨 Erro ao montar o explorador.', embeds: [], files: [], components: [] }).catch(() => {});
        }
    }
}
