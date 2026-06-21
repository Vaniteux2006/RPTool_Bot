// RPTool/supercommands/status/handlers/backfill.ts
// ─── rp!status docpast — Backfill de estatísticas do passado ───────────────────
// Lê o histórico dos canais (via API do Discord) e popula o ServerStats com os
// mesmos buckets (guildId, date, hour) usados pela coleta em tempo real.
//
// Dedupe: usa $setOnInsert (skip-if-exists). Um bucket que JÁ existe — porque a
// coleta em tempo real ou um backfill anterior já o gravou — NÃO é tocado. Logo
// rodar de novo é idempotente e nunca dobra contagem.
//
// Espelha a contabilização de command_checkout:
//   • humano  → total + users + channels + words
//   • webhook → total + ocs (por nome) + channels   (OCs: RPTool/Tupperbox/PluralKit)
//   • outros bots → ignorados
import {
    Message, TextChannel, ChannelType, PermissionsBitField, GuildBasedChannel,
} from 'discord.js';
import ServerStats from '../../../tools/models/ServerStats';

const DEFAULT_DAYS   = 30;     // alcance padrão se nenhuma data for passada
const BATCH_DELAY_MS = 120;    // respiro entre páginas de 100 msgs (rate limit)
const PROGRESS_MS    = 1500;   // intervalo mínimo entre edições da mensagem de progresso

// Mesmas stopwords do tracker em tempo real (command_checkout.trackMessageStats)
const STOPWORDS = new Set([
    'como','para','você','isso','mais','pelo','pela','esse','essa',
    'este','esta','tudo','nada','quem','onde','quando','porque','qual',
    'aqui','sobre','então','muito','dela','dele','https','view','tenor',
    'cara','minha','tenho','tava','fazer','pode','acho','assim','agora',
]);

// Trava de concorrência: um backfill por servidor de cada vez
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

interface Bucket {
    total: number;
    users: Record<string, number>;
    channels: Record<string, number>;
    ocs: Record<string, number>;
    words: Record<string, number>;
}

function emptyBucket(): Bucket {
    return { total: 0, users: {}, channels: {}, ocs: {}, words: {} };
}

function countWords(content: string, target: Record<string, number>): void {
    const words = content.toLowerCase().match(/[a-záàâãéèêíïóôõöúçñ]+/g) ?? [];
    for (const w of words) {
        if (w.length > 4 && !STOPWORDS.has(w)) target[w] = (target[w] ?? 0) + 1;
    }
}

function countMessage(msg: Message, buckets: Map<string, Bucket>): void {
    const d       = new Date(msg.createdTimestamp);
    const dateStr = d.toISOString().split('T')[0];
    const hour    = d.getUTCHours();
    const key     = `${dateStr}#${hour}`;

    let b = buckets.get(key);
    if (!b) { b = emptyBucket(); buckets.set(key, b); }

    const chId = msg.channel.id;

    if (msg.webhookId) {
        b.total++;
        b.channels[chId] = (b.channels[chId] ?? 0) + 1;
        const k = sanitizeOCKey(msg.author.username);
        b.ocs[k] = (b.ocs[k] ?? 0) + 1;
    } else if (!msg.author.bot) {
        b.total++;
        b.channels[chId] = (b.channels[chId] ?? 0) + 1;
        b.users[msg.author.id] = (b.users[msg.author.id] ?? 0) + 1;
        countWords(msg.content, b.words);
    }
    // outros bots: ignorados
}

// ─── Varredura de um canal (do mais recente ao mais antigo, até `sinceTime`) ───
async function scanChannel(
    channel: TextChannel,
    sinceTime: number,
    buckets: Map<string, Bucket>,
    onRead: () => void,
): Promise<void> {
    let before: string | undefined;

    while (true) {
        const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
        if (!batch || batch.size === 0) break;

        let reachedEnd = false;
        for (const msg of batch.values()) {
            if (msg.createdTimestamp < sinceTime) { reachedEnd = true; continue; }
            countMessage(msg, buckets);
            onRead();
        }

        before = batch.last()?.id;
        if (reachedEnd || batch.size < 100 || !before) break;
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
}

// ─── Gravação no Mongo (skip-if-exists via $setOnInsert) ───────────────────────
async function flush(buckets: Map<string, Bucket>, guildId: string): Promise<number> {
    if (buckets.size === 0) return 0;

    const ops = Array.from(buckets.entries()).map(([key, b]) => {
        const [date, hourStr] = key.split('#');
        return {
            updateOne: {
                filter: { guildId, date, hour: +hourStr },
                update: { $setOnInsert: { guildId, date, hour: +hourStr, ...b } },
                upsert: true,
            },
        };
    });

    const res = await ServerStats.bulkWrite(ops as any[], { ordered: false });
    return res.upsertedCount ?? 0;
}

// ─── Handler do comando ────────────────────────────────────────────────────────
export async function handleDocpast(message: Message, args: string[]): Promise<any> {
    if (!message.guild) return message.reply('❌ Esse comando só funciona em servidores.');

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('🔒 Só **administradores** podem rodar o backfill do passado.');
    }

    if (activeBackfills.has(message.guild.id)) {
        return message.reply('⏳ Já existe um backfill rodando neste servidor. Espere ele terminar.');
    }

    // Data inicial (args[0] === 'docpast'; args[1] = data opcional)
    let sinceTime: number;
    let sinceLabel: string;
    if (args[1]) {
        const iso = parseDate(args[1]);
        if (!iso) return message.reply('❌ Data inválida. Use `rp!status docpast DD/MM/AAAA` (ex: `01/01/2025`).');
        sinceTime  = Date.parse(`${iso}T00:00:00Z`);
        sinceLabel = args[1];
    } else {
        sinceTime  = Date.now() - DEFAULT_DAYS * 86_400_000;
        sinceLabel = `${DEFAULT_DAYS} dias atrás`;
    }

    // Canais de texto que o bot consegue ler
    const me = message.guild.members.me;
    const channels = message.guild.channels.cache.filter((c: GuildBasedChannel) =>
        (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
        !!me && c.permissionsFor(me).has(PermissionsBitField.Flags.ViewChannel) &&
        c.permissionsFor(me).has(PermissionsBitField.Flags.ReadMessageHistory),
    ) as Map<string, TextChannel> & { values(): IterableIterator<TextChannel> };

    const channelList = Array.from(channels.values());
    if (channelList.length === 0) {
        return message.reply('❌ Não tenho permissão de **Ver Histórico de Mensagens** em nenhum canal.');
    }

    activeBackfills.add(message.guild.id);
    const buckets = new Map<string, Bucket>();
    let totalRead = 0;
    let channelsDone = 0;
    let lastEdit = 0;

    const status = await message.reply(
        `🔎 **Varredura do passado** iniciada (desde ${sinceLabel}).\n` +
        `Lendo ${channelList.length} canais... isso pode demorar.`,
    );

    const editProgress = async (currentName: string, force = false) => {
        const now = Date.now();
        if (!force && now - lastEdit < PROGRESS_MS) return;
        lastEdit = now;
        await status.edit(
            `⏳ **Varrendo o passado...**\n` +
            `Canais: \`${channelsDone}/${channelList.length}\` • Mensagens lidas: \`${totalRead.toLocaleString('pt-BR')}\`\n` +
            `Atual: ${currentName}`,
        ).catch(() => {});
    };

    try {
        for (const ch of channelList) {
            await editProgress(`<#${ch.id}>`);
            await scanChannel(ch, sinceTime, buckets, () => { totalRead++; });
            channelsDone++;
        }

        await status.edit('💾 Gravando no banco (sem sobrescrever o que já existe)...').catch(() => {});
        const inserted = await flush(buckets, message.guild.id);

        await status.edit(
            `✅ **Backfill concluído!**\n` +
            `• Mensagens lidas: \`${totalRead.toLocaleString('pt-BR')}\`\n` +
            `• Canais varridos: \`${channelsDone}/${channelList.length}\`\n` +
            `• Registros novos gravados: \`${inserted}\` (buckets que já existiam foram preservados)\n\n` +
            `Use \`rp!status\` para ver os dados atualizados. 📊`,
        ).catch(() => {});
    } catch (e) {
        console.error('[Status] Erro no backfill:', e);
        await status.edit('🚨 Erro durante a varredura. Parte dos dados pode não ter sido gravada.').catch(() => {});
    } finally {
        activeBackfills.delete(message.guild.id);
    }
}
