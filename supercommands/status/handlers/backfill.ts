// RPTool/supercommands/status/handlers/backfill.ts
// ─── rp!status docpast — Backfill de estatísticas do passado ───────────────────
// Lê o histórico dos canais (API do Discord) e popula o ServerStats com os mesmos
// buckets (guildId, date, hour) da coleta em tempo real.
//
// Arquitetura (resiliente):
//   • 3 WORKERS paralelos consomem uma fila de canais.
//   • Cada página de 100 msgs é gravada na hora (bulkWrite com $inc) e descartada
//     da memória → memória O(1 página), sem GC thrashing, e nada se perde se cair.
//   • CURSOR por canal (BackfillStateModel): salva até onde leu cada canal. Se for
//     interrompido, `rp!status docpast` retoma de onde parou — não relê tudo.
//   • Flushes serializados (mutex) → $inc concorrente seguro, sem colisão de upsert.
//
// Dedupe: o cursor garante que cada mensagem é contada no máximo uma vez (entre
// execuções). Pode haver sobreposição mínima com a coleta em tempo real no período
// recente — desprezível frente a anos de histórico.
//
// Contabilização (espelha commandCheckout):
//   humano → total + users + channels + words · webhook → total + ocs + channels
import {
    Message, TextChannel, ChannelType, PermissionsBitField, GuildBasedChannel, EmbedBuilder,
} from 'discord.js';
import ServerStats, { BackfillStateModel } from '../../../tools/models/ServerStats';
import { STOPWORDS } from '../../../tools/utils/stopwords';

const DEFAULT_DAYS   = 30;     // alcance padrão se nenhuma data for passada
const WORKERS        = 3;      // canais varridos em paralelo
const BATCH_DELAY_MS = 100;    // respiro entre páginas (rate limit)
const PROGRESS_MS    = 2000;   // intervalo do heartbeat (edição da mensagem)

const activeBackfills = new Set<string>();

function sanitizeOCKey(name: string): string {
    return (name || 'Desconhecido').replace(/[.$]/g, '').trim().slice(0, 80) || 'Desconhecido';
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

interface Bucket { total: number; users: Record<string, number>; channels: Record<string, number>; ocs: Record<string, number>; words: Record<string, number>; }
const emptyBucket = (): Bucket => ({ total: 0, users: {}, channels: {}, ocs: {}, words: {} });

function countWords(content: string, target: Record<string, number>): void {
    const words = content.toLowerCase().match(/[a-záàâãéèêíïóôõöúçñ]+/g) ?? [];
    for (const w of words) if (w.length >= 3 && !STOPWORDS.has(w)) target[w] = (target[w] ?? 0) + 1;
}

function countMessage(msg: Message, buckets: Map<string, Bucket>): void {
    const d = new Date(msg.createdTimestamp);
    const key = `${d.toISOString().split('T')[0]}#${d.getUTCHours()}`;
    let b = buckets.get(key);
    if (!b) { b = emptyBucket(); buckets.set(key, b); }
    const chId = msg.channel.id;

    if (msg.webhookId) {
        b.total++; b.channels[chId] = (b.channels[chId] ?? 0) + 1;
        const k = sanitizeOCKey(msg.author.username);
        b.ocs[k] = (b.ocs[k] ?? 0) + 1;
    } else if (!msg.author.bot) {
        b.total++; b.channels[chId] = (b.channels[chId] ?? 0) + 1;
        b.users[msg.author.id] = (b.users[msg.author.id] ?? 0) + 1;
        countWords(msg.content, b.words);
    }
}

// ─── Gravação incremental por página (bulkWrite com $inc, serializada) ─────────
let flushLock: Promise<any> = Promise.resolve();

async function flushInc(buckets: Map<string, Bucket>, guildId: string): Promise<void> {
    if (buckets.size === 0) return;
    const ops = Array.from(buckets.entries()).map(([key, b]) => {
        const [date, hourStr] = key.split('#');
        const inc: Record<string, number> = { total: b.total };
        for (const [k, v] of Object.entries(b.users))    inc[`users.${k}`] = v;
        for (const [k, v] of Object.entries(b.channels)) inc[`channels.${k}`] = v;
        for (const [k, v] of Object.entries(b.ocs))      inc[`ocs.${k}`] = v;
        for (const [k, v] of Object.entries(b.words))    inc[`words.${k}`] = v;
        return { updateOne: { filter: { guildId, date, hour: +hourStr }, update: { $inc: inc }, upsert: true } };
    });
    // Serializa os flushes dos workers → evita colisão de upsert no mesmo bucket.
    const run = flushLock.then(() => ServerStats.bulkWrite(ops as any[], { ordered: false }));
    flushLock = run.catch(() => {});
    await run;
}

interface Shared {
    totalRead: number;
    channelsDone: number;
    active: Map<number, string>; // workerId → "#canal · data"
}

// ─── Processa um canal: lê pra trás, grava cada página, salva o cursor ─────────
async function processChannel(channel: TextChannel, sinceTime: number, guildId: string, shared: Shared, wid: number): Promise<void> {
    const state: any = await BackfillStateModel.findOne({ guildId, channelId: channel.id }).lean();
    if (state?.complete) { shared.channelsDone++; return; }
    let before: string | undefined = state?.beforeId || undefined;

    while (true) {
        const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
        if (!batch || batch.size === 0) break;

        const pageBuckets = new Map<string, Bucket>();
        let reachedEnd = false;
        let oldestTs = 0;
        for (const msg of batch.values()) {
            if (msg.createdTimestamp < sinceTime) { reachedEnd = true; continue; }
            countMessage(msg, pageBuckets);
            shared.totalRead++;
            oldestTs = msg.createdTimestamp;
        }

        await flushInc(pageBuckets, guildId);                 // grava a página AGORA
        before = batch.last()?.id;
        await BackfillStateModel.updateOne(                    // só então move o cursor
            { guildId, channelId: channel.id },
            { $set: { beforeId: before ?? null } },
            { upsert: true },
        ).catch(() => {});

        if (oldestTs) shared.active.set(wid, `<#${channel.id}> · ${new Date(oldestTs).toLocaleDateString('pt-BR')}`);
        if (reachedEnd || batch.size < 100 || !before) break;
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }

    await BackfillStateModel.updateOne(
        { guildId, channelId: channel.id },
        { $set: { complete: true } },
        { upsert: true },
    ).catch(() => {});
    shared.channelsDone++;
}

// ─── Handler do comando ────────────────────────────────────────────────────────
export async function handleDocpast(message: Message, args: string[]): Promise<any> {
    if (!message.guild) return message.reply('❌ Esse comando só funciona em servidores.');
    const guildId = message.guild.id;
    const guildName = message.guild.name;

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('🔒 Só **administradores** podem rodar o backfill do passado.');
    }
    if (activeBackfills.has(guildId)) {
        return message.reply('⏳ Já existe um backfill rodando neste servidor. Espere ele terminar.');
    }

    // Reset: limpa os cursores → o próximo docpast recomeça a varredura do zero.
    if (args[1]?.toLowerCase() === 'reset') {
        const res = await BackfillStateModel.deleteMany({ guildId });
        return message.reply(
            `🔄 Cursores de backfill limpos (**${res.deletedCount}** canais). O próximo \`rp!status docpast <data>\` recomeça do zero.\n` +
            `⚠️ Se um backfill anterior já tinha **gravado** dados, rodar de novo soma por cima (dobra).`,
        );
    }

    // Data inicial (args[1] = data opcional)
    // Semântica: a data é o INÍCIO — lê DESDE ela ATÉ hoje. (docpast 14/05/2023 = de 2023 até agora.)
    let sinceTime: number, sinceLabel: string;
    if (args[1]) {
        const iso = parseDate(args[1]);
        if (!iso) return message.reply('❌ Data inválida. Use `rp!status docpast DD/MM/AAAA` (ex: `01/01/2025`).');
        sinceTime = Date.parse(`${iso}T00:00:00Z`); sinceLabel = args[1];
    } else {
        sinceTime = Date.now() - DEFAULT_DAYS * 86_400_000; sinceLabel = `${DEFAULT_DAYS} dias atrás`;
    }

    const me = message.guild.members.me;
    const channels = message.guild.channels.cache.filter((c: GuildBasedChannel) =>
        (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
        !!me && c.permissionsFor(me).has(PermissionsBitField.Flags.ViewChannel) &&
        c.permissionsFor(me).has(PermissionsBitField.Flags.ReadMessageHistory),
    ) as Map<string, TextChannel> & { values(): IterableIterator<TextChannel> };

    const channelList = Array.from(channels.values());
    if (channelList.length === 0) return message.reply('❌ Não tenho permissão de **Ver Histórico** em nenhum canal.');

    activeBackfills.add(guildId);
    const shared: Shared = { totalRead: 0, channelsDone: 0, active: new Map() };
    const startedAt = Date.now();
    const status = await message.reply('🔎 Iniciando varredura do passado...');

    const bar = (done: number, total: number) => {
        const filled = total > 0 ? Math.round((done / total) * 14) : 0;
        return '▰'.repeat(filled) + '▱'.repeat(14 - filled);
    };

    const renderEmbed = (state: 'run' | 'done' | 'err', extra = ''): EmbedBuilder => {
        const el = Math.floor((Date.now() - startedAt) / 1000);
        const embed = new EmbedBuilder()
            .setColor(state === 'done' ? 0x2ecc71 : state === 'err' ? 0xe74c3c : 0x5865F2)
            .setTitle(state === 'done' ? '✅ Backfill concluído!' : state === 'err' ? '🚨 Backfill interrompido' : '🔎 Varrendo o passado...')
            .addFields(
                { name: 'Progresso', value: `${bar(shared.channelsDone, channelList.length)}  \`${shared.channelsDone}/${channelList.length}\` canais`, inline: false },
                { name: 'Mensagens lidas', value: `\`${shared.totalRead.toLocaleString('pt-BR')}\``, inline: true },
                { name: 'Tempo', value: `\`${Math.floor(el / 60)}m ${el % 60}s\``, inline: true },
            );
        if (state === 'run' && shared.active.size) {
            embed.addFields({ name: `Workers (${WORKERS})`, value: Array.from(shared.active.values()).join('\n') || '—', inline: false });
        }
        if (extra) embed.addFields({ name: '​', value: extra, inline: false });
        return embed.setFooter({ text: `desde ${sinceLabel} • heartbeat (grava aos poucos)` }).setTimestamp();
    };

    console.log(`🔎 [Backfill] Iniciado em "${guildName}" — ${channelList.length} canais (${WORKERS} workers), desde ${sinceLabel}.`);
    const heartbeat = setInterval(() => { status.edit({ content: null, embeds: [renderEmbed('run')] }).catch(() => {}); }, PROGRESS_MS);

    const queue = [...channelList];
    const runWorker = async (wid: number) => {
        while (queue.length) {
            const ch = queue.shift();
            if (!ch) break;
            shared.active.set(wid, `<#${ch.id}>`);
            try { await processChannel(ch, sinceTime, guildId, shared, wid); }
            catch (e) { console.error(`   [Backfill] Erro no canal #${ch.name}:`, e); }
        }
        shared.active.delete(wid);
    };

    try {
        await Promise.all(Array.from({ length: WORKERS }, (_, i) => runWorker(i)));
        clearInterval(heartbeat);
        console.log(`✅ [Backfill] Concluído em "${guildName}": ${shared.totalRead} msgs lidas.`);
        await status.edit({ content: null, embeds: [renderEmbed('done',
            `Lidas \`${shared.totalRead.toLocaleString('pt-BR')}\` mensagens e gravadas direto no banco.\nUse \`rp!status\` para ver os dados. 📊`)] }).catch(() => {});
    } catch (e) {
        clearInterval(heartbeat);
        console.error(`🚨 [Backfill] Erro em "${guildName}":`, e);
        await status.edit({ content: null, embeds: [renderEmbed('err',
            'O que já foi lido está salvo. Rode `rp!status docpast` de novo para **retomar de onde parou**.')] }).catch(() => {});
    } finally {
        clearInterval(heartbeat);
        activeBackfills.delete(guildId);
    }
}
