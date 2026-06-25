// RPTool/supercommands/status/handlers/aggregate.ts
// ─── Base de agregação temporal do ServerStats ────────────────────────────────
// Utilitários reusados por heatmap / historico / profile / wrapped.
// Os docs vêm com .lean() → os campos Map (users/channels/ocs/words) viram
// objetos planos; por isso iteramos com Object.entries (chaves já são limpas:
// IDs numéricos, nomes de OC sanitizados, palavras só com letras).
import axios from 'axios';
import { AttachmentBuilder, Client } from 'discord.js';
import ServerStats, { UserChannelModel } from '../../../tools/models/ServerStats';

export type StatField = 'users' | 'channels' | 'ocs' | 'words';

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// ─── Busca de período ─────────────────────────────────────────────────────────
// Sem datas = todo o histórico. fromISO/toISO no formato 'YYYY-MM-DD'.
export async function fetchRange(guildId: string, fromISO?: string, toISO?: string): Promise<any[]> {
    const q: any = { guildId };
    if (fromISO || toISO) {
        q.date = {};
        if (fromISO) q.date.$gte = fromISO;
        if (toISO) q.date.$lte = toISO;
    }
    return ServerStats.find(q).lean();
}

function mapEntries(m: any): [string, number][] {
    return m ? (Object.entries(m) as [string, number][]) : [];
}

// Valor de um doc para a métrica pedida: total do bucket, ou só o que `uid` falou.
function valueOf(s: any, uid?: string): number {
    return uid ? (s.users?.[uid] || 0) : (s.total || 0);
}

// ─── Somatórios ───────────────────────────────────────────────────────────────
export function totalOf(stats: any[], uid?: string): number {
    let t = 0;
    for (const s of stats) t += valueOf(s, uid);
    return t;
}

// Agrega um Map (users/channels/ocs/words) → Record<chave, total>.
export function sumMap(stats: any[], field: StatField): Record<string, number> {
    const totals: Record<string, number> = {};
    const onlyHumans = field === 'users';
    for (const s of stats) {
        for (const [k, v] of mapEntries(s[field])) {
            if (onlyHumans && !/^\d{17,20}$/.test(k)) continue; // exclui _id de OC legado
            totals[k] = (totals[k] || 0) + v;
        }
    }
    return totals;
}

export function topN(rec: Record<string, number>, n: number): [string, number][] {
    return Object.entries(rec).sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ─── Histogramas temporais ────────────────────────────────────────────────────
export function hourHistogram(stats: any[], uid?: string): number[] {
    const h = new Array(24).fill(0);
    for (const s of stats) h[s.hour] += valueOf(s, uid);
    return h;
}

export function weekdayHistogram(stats: any[], uid?: string): number[] {
    const w = new Array(7).fill(0);
    for (const s of stats) {
        const wd = new Date(`${s.date}T00:00:00Z`).getUTCDay();
        w[wd] += valueOf(s, uid);
    }
    return w;
}

// Matriz [dia-da-semana 0-6][hora 0-23] para o heatmap.
export function heatMatrix(stats: any[], uid?: string): number[][] {
    const m = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const s of stats) {
        const v = valueOf(s, uid);
        if (!v) continue;
        const wd = new Date(`${s.date}T00:00:00Z`).getUTCDay();
        m[wd][s.hour] += v;
    }
    return m;
}

export interface MonthPoint { ym: string; total: number; }

export function monthlySeries(stats: any[], uid?: string): MonthPoint[] {
    const map: Record<string, number> = {};
    for (const s of stats) {
        const v = valueOf(s, uid);
        if (!v) continue;
        const ym = String(s.date).slice(0, 7); // YYYY-MM
        map[ym] = (map[ym] || 0) + v;
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([ym, total]) => ({ ym, total }));
}

export function peakDay(stats: any[], uid?: string): { date: string; total: number } {
    const map: Record<string, number> = {};
    for (const s of stats) map[s.date] = (map[s.date] || 0) + valueOf(s, uid);
    let best = { date: '', total: 0 };
    for (const [date, total] of Object.entries(map)) if (total > best.total) best = { date, total };
    return best;
}

// Primeira e última data em que `uid` apareceu (ou o servidor, se sem uid).
export function activeRange(stats: any[], uid?: string): { first: string; last: string } {
    let first = '', last = '';
    for (const s of stats) {
        if (!valueOf(s, uid)) continue;
        if (!first || s.date < first) first = s.date;
        if (!last || s.date > last) last = s.date;
    }
    return { first, last };
}

// ─── Helpers de formatação ────────────────────────────────────────────────────
export const fmt = (n: number) => n.toLocaleString('pt-BR');

export function formatYM(ym: string): string {
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const [y, m] = ym.split('-');
    return `${meses[+m - 1]}/${y.slice(2)}`;
}

export function formatDateBR(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

export function argMax(arr: number[]): number {
    let bi = 0;
    for (let i = 1; i < arr.length; i++) if (arr[i] > arr[bi]) bi = i;
    return bi;
}

// ─── Canal favorito de um usuário (Fase 2 — prospectivo) ──────────────────────
// Retorna [channelId, count] do canal mais usado, ou null se ainda não há dado.
export async function userTopChannel(guildId: string, uid: string): Promise<[string, number] | null> {
    const doc: any = await UserChannelModel.findOne({ guildId, userId: uid }).lean();
    if (!doc?.channels) return null;
    const top = topN(doc.channels as Record<string, number>, 1);
    return top.length ? top[0] : null;
}

// ─── Resolução de nomes ───────────────────────────────────────────────────────
export async function resolveUserName(client: Client, id: string): Promise<string> {
    const u = await client.users.fetch(id).catch(() => null);
    return u ? u.username : `ID ${id.slice(0, 6)}…`;
}

// ════════════════════════════════════════════════════════════════════════════
// AGREGAÇÃO NO BANCO (pipelines) — para o Explorador, escalável a "todos os tempos"
// ════════════════════════════════════════════════════════════════════════════
function matchStage(guildId: string, from?: string | null, to?: string | null) {
    const m: any = { guildId };
    if (from || to) { m.date = {}; if (from) m.date.$gte = from; if (to) m.date.$lte = to; }
    return { $match: m };
}

// Período curto (≤ ~92 dias) → granularidade diária; senão → mensal.
function isShortRange(from?: string | null, to?: string | null): boolean {
    if (!from || !to) return false;
    return (Date.parse(to) - Date.parse(from)) / 86_400_000 <= 92;
}

export async function aggTotal(guildId: string, from?: string | null, to?: string | null): Promise<number> {
    const r = await ServerStats.aggregate([matchStage(guildId, from, to), { $group: { _id: null, total: { $sum: '$total' } } }], { allowDiskUse: true });
    return r[0]?.total ?? 0;
}

export interface SeriesPoint { period: string; total: number; }

export async function aggTimeline(guildId: string, from?: string | null, to?: string | null): Promise<SeriesPoint[]> {
    const periodExpr = isShortRange(from, to) ? '$date' : { $substr: ['$date', 0, 7] };
    const r = await ServerStats.aggregate([
        matchStage(guildId, from, to),
        { $group: { _id: periodExpr, total: { $sum: '$total' } } },
        { $sort: { _id: 1 } },
    ], { allowDiskUse: true });
    return r.map((x: any) => ({ period: x._id, total: x.total }));
}

// Top de users/channels/ocs/words num período (paginado).
export async function aggTop(guildId: string, from: string | null, to: string | null, field: StatField, skip: number, limit: number): Promise<[string, number][]> {
    const pipeline: any[] = [
        matchStage(guildId, from, to),
        { $project: { kv: { $objectToArray: `$${field}` } } },
        { $unwind: '$kv' },
        { $group: { _id: '$kv.k', total: { $sum: '$kv.v' } } },
    ];
    if (field === 'users') pipeline.push({ $match: { _id: { $regex: '^[0-9]{17,20}$' } } });
    pipeline.push({ $sort: { total: -1 } }, { $skip: skip }, { $limit: limit });
    const r = await ServerStats.aggregate(pipeline, { allowDiskUse: true });
    return r.map((x: any) => [x._id, x.total]);
}

export async function aggTopCount(guildId: string, from: string | null, to: string | null, field: StatField): Promise<number> {
    const pipeline: any[] = [
        matchStage(guildId, from, to),
        { $project: { kv: { $objectToArray: `$${field}` } } },
        { $unwind: '$kv' },
        { $group: { _id: '$kv.k' } },
    ];
    if (field === 'users') pipeline.push({ $match: { _id: { $regex: '^[0-9]{17,20}$' } } });
    pipeline.push({ $count: 'n' });
    const r = await ServerStats.aggregate(pipeline, { allowDiskUse: true });
    return r[0]?.n ?? 0;
}

// Série temporal de UMA chave dentro de um Map (palavra, ou id de user/canal).
export async function aggKeyTimeline(guildId: string, from: string | null, to: string | null, field: StatField, key: string): Promise<SeriesPoint[]> {
    const periodExpr = isShortRange(from, to) ? '$date' : { $substr: ['$date', 0, 7] };
    const r = await ServerStats.aggregate([
        matchStage(guildId, from, to),
        { $project: {
            period: periodExpr,
            v: { $let: {
                vars: { f: { $filter: { input: { $objectToArray: `$${field}` }, cond: { $eq: ['$$this.k', key] } } } },
                in: { $sum: '$$f.v' },
            } },
        } },
        { $group: { _id: '$period', total: { $sum: '$v' } } },
        { $sort: { _id: 1 } },
    ], { allowDiskUse: true });
    return r.map((x: any) => ({ period: x._id, total: x.total }));
}

// ─── Trending: palavras em alta (lift) + momentos quentes ─────────────────────
const TREND_MIN_RECENT = 5; // volume mínimo na janela recente p/ ser candidato

export interface TrendWord { word: string; recent: number; base: number; lift: number; }

// Deriva as janelas (recente vs baseline) a partir da janela e da âncora temporal.
export function trendWindows(window: '24h' | '7d' | '30d', anchorISO: string | null) {
    const recentDays = window === '24h' ? 1 : window === '7d' ? 7 : 30;
    const baseDays = recentDays * 8;
    const anchor = anchorISO ? new Date(`${anchorISO}T23:59:59Z`) : new Date();
    const iso = (d: Date) => d.toISOString().split('T')[0];
    const recentFromD = new Date(anchor.getTime() - recentDays * 86_400_000);
    const baseFromD = new Date(recentFromD.getTime() - baseDays * 86_400_000);
    return {
        recentFrom: iso(recentFromD), recentTo: iso(anchor),
        baseFrom: iso(baseFromD), baseTo: iso(recentFromD),
        recentDays, baseDays,
    };
}

export async function aggTrendingWords(guildId: string, w: ReturnType<typeof trendWindows>): Promise<TrendWord[]> {
    const recentTop = await aggTop(guildId, w.recentFrom, w.recentTo, 'words', 0, 40);
    const candidates = recentTop.filter(([, c]) => c >= TREND_MIN_RECENT);
    if (candidates.length === 0) return [];
    const words = candidates.map(([word]) => word);

    const baseRows = await ServerStats.aggregate([
        matchStage(guildId, w.baseFrom, w.baseTo),
        { $project: { kv: { $objectToArray: '$words' } } },
        { $unwind: '$kv' },
        { $match: { 'kv.k': { $in: words } } },
        { $group: { _id: '$kv.k', total: { $sum: '$kv.v' } } },
    ], { allowDiskUse: true });
    const baseMap: Record<string, number> = {};
    for (const r of baseRows) baseMap[r._id] = r.total;

    return candidates.map(([word, recent]) => {
        const base = baseMap[word] || 0;
        const recRate = recent / w.recentDays;
        const baseRate = base / w.baseDays;
        const lift = recRate / (baseRate + 1 / w.baseDays); // suavização (≈ 1 ocorrência esperada)
        return { word, recent, base, lift };
    }).sort((a, b) => b.lift - a.lift).slice(0, 10);
}

export interface HotMoment { date: string; hour: number; total: number; channel: string | null; }

export async function aggHotMoments(guildId: string, from: string | null, to: string | null, limit: number): Promise<HotMoment[]> {
    const rows = await ServerStats.aggregate([
        matchStage(guildId, from, to),
        { $sort: { total: -1 } },
        { $limit: limit },
        { $project: { date: 1, hour: 1, total: 1, channels: 1 } },
    ], { allowDiskUse: true });
    return rows.map((r: any) => {
        let topCh: string | null = null, topV = 0;
        for (const [c, v] of Object.entries(r.channels || {})) { if ((v as number) > topV) { topV = v as number; topCh = c; } }
        return { date: r.date, hour: r.hour, total: r.total, channel: topCh };
    });
}

// ─── Período: presets e rótulos ───────────────────────────────────────────────
export function presetRange(preset: string): { from: string | null; to: string | null } {
    const now = new Date();
    const y = now.getUTCFullYear();
    const iso = (d: Date) => d.toISOString().split('T')[0];
    switch (preset) {
        case 'year':     return { from: `${y}-01-01`, to: `${y}-12-31` };
        case 'lastyear': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
        case '30d':      return { from: iso(new Date(Date.now() - 30 * 86_400_000)), to: iso(now) };
        default:         return { from: null, to: null }; // 'all'
    }
}

export function periodLabel(from?: string | null, to?: string | null): string {
    if (!from && !to) return 'Todos os tempos';
    return `${from ? formatDateBR(from) : '…'} → ${to ? formatDateBR(to) : 'hoje'}`;
}

// Formata o rótulo do eixo X (mês 'YYYY-MM' → 'mar/24'; dia 'YYYY-MM-DD' → 'DD/MM').
export function formatPeriodPoint(p: string): string {
    return p.length === 7 ? formatYM(p) : `${p.slice(8, 10)}/${p.slice(5, 7)}`;
}

// ─── Gráfico de linha (QuickChart) — reusado por historico e profile ──────────
export async function lineChart(labels: string[], data: number[], name = 'chart.png'): Promise<AttachmentBuilder> {
    const cfg = {
        type: 'line',
        data: { labels, datasets: [{ data, borderColor: '#5865F2', backgroundColor: 'rgba(88,101,242,0.15)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }] },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#8e9297', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: '#8e9297', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
        },
    };
    const url = `https://quickchart.io/chart?bkg=${encodeURIComponent('#2b2d31')}&w=700&h=250&c=${encodeURIComponent(JSON.stringify(cfg))}`;
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return new AttachmentBuilder(Buffer.from(res.data), { name });
}

// Gráfico de linha com 1+ séries (Ngram / comparação de termos).
const SERIES_COLORS = ['#5865F2', '#43b581', '#faa61a'];
export async function lineChartMulti(labels: string[], series: { label: string; data: number[] }[], name = 'chart.png'): Promise<AttachmentBuilder> {
    const cfg = {
        type: 'line',
        data: {
            labels,
            datasets: series.map((s, i) => ({
                label: s.label, data: s.data,
                borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
                backgroundColor: series.length === 1 ? 'rgba(88,101,242,0.15)' : 'transparent',
                fill: series.length === 1, tension: 0.35, pointRadius: 0, borderWidth: 2,
            })),
        },
        options: {
            plugins: { legend: { display: series.length > 1, labels: { color: '#dbdee1', font: { size: 11 } } } },
            scales: {
                x: { ticks: { color: '#8e9297', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: '#8e9297', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
        },
    };
    const url = `https://quickchart.io/chart?bkg=${encodeURIComponent('#2b2d31')}&w=700&h=260&c=${encodeURIComponent(JSON.stringify(cfg))}`;
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return new AttachmentBuilder(Buffer.from(res.data), { name });
}
