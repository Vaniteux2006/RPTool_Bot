// RPTool/supercommands/status/handlers/trending.ts
// ─── rp!status trending — Em alta (palavras acelerando) + momentos quentes ────
// Trending por "lift": frequência recente vs. linha de base. Funciona em qualquer
// ponto do tempo (âncora) → também mostra o que estava em alta no passado.
//
// customId: `stats_trend:<window>:<anchor>:<uid>`  (window 24h|7d|30d · anchor now|YYYY-MM-DD)
import {
    Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, Client, Guild,
} from 'discord.js';
import { trendWindows, aggTrendingWords, aggHotMoments, formatDateBR, fmt } from './aggregate';

type Win = '24h' | '7d' | '30d';
interface State { window: Win; anchor: string; uid: string; } // anchor = 'now' | 'YYYY-MM-DD'

const recentDaysOf = (w: Win) => (w === '24h' ? 1 : w === '7d' ? 7 : 30);

function parseBRDate(s: string): string | null {
    const m = (s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function shiftAnchor(anchor: string, window: Win, dir: number): string {
    const today = new Date();
    const base = anchor === 'now' ? today : new Date(`${anchor}T12:00:00Z`);
    const shifted = new Date(base.getTime() + dir * recentDaysOf(window) * 86_400_000);
    return shifted.getTime() >= today.getTime() ? 'now' : shifted.toISOString().split('T')[0];
}

// ─── Componentes ──────────────────────────────────────────────────────────────
function windowRow(s: State): ActionRowBuilder<ButtonBuilder> {
    const wins: [Win, string][] = [['24h', 'Dia'], ['7d', 'Semana'], ['30d', 'Mês']];
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        wins.map(([w, label]) =>
            new ButtonBuilder().setCustomId(`stats_trend:${w}:${s.anchor}:${s.uid}`).setLabel(label)
                .setStyle(s.window === w ? ButtonStyle.Primary : ButtonStyle.Secondary)),
    );
}
function navRow(s: State): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`stats_trend:${s.window}:${shiftAnchor(s.anchor, s.window, -1)}:${s.uid}`).setEmoji('◀️').setLabel('Antes').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`stats_trenddate:${s.window}:${s.uid}`).setEmoji('📅').setLabel('Ir pra data').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`stats_trend:${s.window}:${shiftAnchor(s.anchor, s.window, 1)}:${s.uid}`).setEmoji('▶️').setLabel('Depois').setStyle(ButtonStyle.Secondary).setDisabled(s.anchor === 'now'),
    );
}

// ─── Monta o painel ───────────────────────────────────────────────────────────
export async function buildTrendingPayload(_client: Client, guild: Guild, s: State): Promise<any> {
    const w = trendWindows(s.window, s.anchor === 'now' ? null : s.anchor);
    const [trend, hot] = await Promise.all([
        aggTrendingWords(guild.id, w),
        aggHotMoments(guild.id, w.recentFrom, w.recentTo, 5),
    ]);

    const quando = s.anchor === 'now' ? '**agora**' : `em **${formatDateBR(w.recentTo)}**`;
    const altaTxt = trend.length
        ? trend.map((t, i) => `**${i + 1}.** \`${t.word}\` — ${t.base === 0 ? '🆕 **novo**' : `↑ **${t.lift.toFixed(1)}x**`} · ${fmt(t.recent)}×`).join('\n')
        : '_nada disparou nessa janela._';
    const hotTxt = hot.length
        ? hot.map(h => `🔥 **${formatDateBR(h.date)} ${String(h.hour).padStart(2, '0')}h** — \`${fmt(h.total)}\` msgs${h.channel ? ` · <#${h.channel}>` : ''}`).join('\n')
        : '_sem picos registrados._';

    const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(`🔥 Em Alta · ${guild.name}`)
        .setDescription(`O que estava bombando ${quando} (janela: **${formatDateBR(w.recentFrom)} → ${formatDateBR(w.recentTo)}**).`)
        .addFields(
            { name: '🔥 Palavras em Alta', value: altaTxt.slice(0, 1024), inline: false },
            { name: '💥 Momentos Quentes', value: hotTxt.slice(0, 1024), inline: false },
        )
        .setFooter({ text: 'RPTool | Trending • use ◀ ▶ 📅 para viajar no tempo' })
        .setTimestamp();

    return { content: null, embeds: [embed], files: [], components: [windowRow(s), navRow(s)] };
}

// ─── Comando: rp!status trending [janela] [data] ──────────────────────────────
export async function handleTrending(message: Message, args: string[]): Promise<any> {
    let window: Win = '7d';
    let anchor = 'now';
    for (const a of args.slice(1)) {
        const low = a.toLowerCase();
        if (low === '24h' || low === 'dia') window = '24h';
        else if (low === '7d' || low === 'semana') window = '7d';
        else if (low === '30d' || low === 'mes' || low === 'mês') window = '30d';
        else { const iso = parseBRDate(a); if (iso) anchor = iso; }
    }
    const payload = await buildTrendingPayload(message.client, message.guild as Guild, { window, anchor, uid: message.author.id });
    return message.reply(payload);
}

// ─── Roteador das interações stats_trend* ─────────────────────────────────────
export async function handleTrendingInteraction(interaction: any): Promise<void> {
    const id: string = interaction.customId;
    const uid = id.split(':').pop();
    if (interaction.user.id !== uid) { await interaction.reply({ content: '🔒 Esse painel não é seu.' }).catch(() => {}); return; }

    try {
        if (interaction.isButton() && id.startsWith('stats_trenddate:')) {
            const [, window] = id.split(':');
            const modal = new ModalBuilder().setCustomId(`stats_trenddatemod:${window}:${uid}`).setTitle('Trending de uma data');
            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder().setCustomId('data').setLabel('Data (DD/MM/AAAA)').setPlaceholder('14/02/2024').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)));
            return await interaction.showModal(modal);
        }
        if (interaction.isModalSubmit() && id.startsWith('stats_trenddatemod:')) {
            const [, window] = id.split(':');
            const iso = parseBRDate(interaction.fields.getTextInputValue('data'));
            if (!iso) { await interaction.reply({ content: '❌ Data inválida. Use `DD/MM/AAAA`.' }).catch(() => {}); return; }
            await interaction.deferUpdate();
            return await interaction.editReply(await buildTrendingPayload(interaction.client, interaction.guild, { window: window as Win, anchor: iso, uid }));
        }
        if (interaction.isButton() && id.startsWith('stats_trend:')) {
            const [, window, anchor] = id.split(':');
            await interaction.deferUpdate();
            return await interaction.editReply(await buildTrendingPayload(interaction.client, interaction.guild, { window: window as Win, anchor, uid }));
        }
    } catch (e) {
        console.error('[Status] Erro no trending:', e);
        if (interaction.isRepliable?.() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '🚨 Erro ao montar o trending.' }).catch(() => {});
        }
    }
}
