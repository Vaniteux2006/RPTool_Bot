// RPTool/supercommands/tempo/handlers/clock.ts
// CRUD completo dos relógios RP
import { Message, TextChannel } from 'discord.js';
import { ClockModel } from '../../../tools/models/ClockSchema';
import { formatClockMessage, computeRPGTime } from '../clockEngine';
import { extractArgs } from '../../../tools/utils/textUtils';

// ─── Parseia "1m", "2h", "3d" em milissegundos ───────────────────────────────
export function parseTimeStr(str: string): number {
    if (!str) return 0;
    const m = str.match(/^(\d+(?:[.,]\d+)?)\s*([mhd])$/i);
    if (!m) return 0;
    const val  = parseFloat(m[1].replace(',', '.'));
    const unit = m[2].toLowerCase();
    if (unit === 'm') return val * 60_000;
    if (unit === 'h') return val * 3_600_000;
    if (unit === 'd') return val * 86_400_000;
    return 0;
}

// ─── Parseia "1m -> 1h" em multiplicador de velocidade ───────────────────────
// Retorna quantos ms RP passam por ms real
function parseVelocityExpr(tokens: string[]): number {
    // Espera: ["1m", "->", "1h"]  ou  ["1h", "->", "1d"]
    if (tokens.length < 3 || tokens[1] !== '->') return 1;
    const from = parseTimeStr(tokens[0]);
    const to   = parseTimeStr(tokens[2]);
    return from === 0 ? 1 : to / from;
}

// ─── rp!tempo #canal [Nome] ────────────────────────────────────────────────────
// Cria relógio simples com hora real
export async function handleCreate(message: Message, args: string[]) {
    // args[0] deve ser a menção do canal: <#id>
    const chanMention = args[0];
    if (!chanMention?.startsWith('<#')) {
        return message.reply('⚠️ **Uso:** `rp!tempo #canal [Nome]`\nEx: `rp!tempo #seattle`');
    }

    const cid  = chanMention.replace(/[<#>]/g, '');
    const ch   = message.guild?.channels.cache.get(cid) as TextChannel | undefined;
    if (!ch) return message.reply('❌ Canal não encontrado neste servidor.');

    const name = args[1] ?? `AUTO_${cid}`;

    if (!message.guild!.members.cache.get(message.author.id)?.permissions.has('ManageChannels')) {
        return message.reply('❌ Você precisa de permissão **Gerenciar Canais** para criar relógios.');
    }

    // Remove anterior com mesmo nome ou mesmo canal AUTO_
    await ClockModel.deleteOne({ $or: [{ name }, { name: `AUTO_${cid}` }] });

    const clockMsg  = await ch.send('⏳ Iniciando relógio...');
    const now       = Date.now();

    const clock = await ClockModel.create({
        name,
        channelId:  cid,
        messageId:  clockMsg.id,
        guildId:    message.guild!.id,
        anchorReal: now,
        anchorRPG:  now,
        velocity:   1,
        dilation:   1,
        timezone:   'UTC',
    });

    await clockMsg.edit(formatClockMessage(clock, new Date(now), null));

    return message.reply(`✅ Relógio **${name}** criado em ${ch}.\nUse \`rp!tempo set ${name}\` para configurar data/hora RP.`);
}

// ─── rp!tempo set <Nome> [#canal] <DD/MM/AAAA> <HH:MM> [+ Xm -> Yh] [/ Xm -> Yh] ────
// Cria ou reposiciona um relógio com data/hora RP específica
export async function handleSet(message: Message, args: string[]) {
    // Análise de argumentos (flexível quanto à posição do #canal)
    let name       = '';
    let targetCh   = message.channel as TextChannel;
    let dateStr    = '';
    let timeStr    = '';
    let modsStart  = 0;

    // Detecta onde está o #canal (pode ser args[1] ou args[2])
    if (args[1]?.startsWith('<#')) {
        const cid = args[1].replace(/[<#>]/g, '');
        const ch  = message.guild?.channels.cache.get(cid) as TextChannel | undefined;
        if (ch) targetCh = ch;
        name = args[2] ?? ''; dateStr = args[3] ?? ''; timeStr = args[4] ?? ''; modsStart = 5;
    } else if (args[2]?.startsWith('<#')) {
        name = args[1] ?? '';
        const cid = args[2].replace(/[<#>]/g, '');
        const ch  = message.guild?.channels.cache.get(cid) as TextChannel | undefined;
        if (ch) targetCh = ch;
        dateStr = args[3] ?? ''; timeStr = args[4] ?? ''; modsStart = 5;
    } else {
        name = args[1] ?? ''; dateStr = args[2] ?? ''; timeStr = args[3] ?? ''; modsStart = 4;
    }

    if (!name || !dateStr || !timeStr) {
        return message.reply(
            '⚠️ **Uso:** `rp!tempo set <Nome> [#canal] <DD/MM/AAAA> <HH:MM> [+ Xm -> Yh]`\n' +
            'Ex: `rp!tempo set Seattle 01/01/2005 15:30 + 1m -> 10m`',
        );
    }

    const [day, month, year] = dateStr.split('/').map(Number);
    const [hour, min]        = timeStr.split(':').map(Number);
    const rpgDate            = new Date(Date.UTC(year, month - 1, day, hour, min));

    if (isNaN(rpgDate.getTime())) {
        return message.reply('❌ Data ou hora inválida. Use o formato `DD/MM/AAAA HH:MM`.');
    }

    if (!message.guild!.members.cache.get(message.author.id)?.permissions.has('ManageChannels')) {
        return message.reply('❌ Você precisa de permissão **Gerenciar Canais** para configurar relógios.');
    }

    // Parseia modificadores de velocidade
    const mods     = args.slice(modsStart);
    const plusIdx  = mods.indexOf('+');
    const slashIdx = mods.indexOf('/');
    const velocity = plusIdx  !== -1 ? parseVelocityExpr(mods.slice(plusIdx  + 1, plusIdx  + 4)) : 1;
    const dilation = slashIdx !== -1 ? parseVelocityExpr(mods.slice(slashIdx + 1, slashIdx + 4)) : 1;

    // Preserva geo se já existia
    const old = await ClockModel.findOne({ name });
    await ClockModel.deleteOne({ name });

    const clockMsg = await targetCh.send('⏳ Configurando relógio...');
    const now      = Date.now();

    const clock = await ClockModel.create({
        name,
        channelId:    targetCh.id,
        messageId:    clockMsg.id,
        guildId:      message.guild!.id,
        anchorReal:   now,
        anchorRPG:    rpgDate.getTime(),
        velocity,
        dilation,
        timezone:     'UTC',
        latitude:     old?.latitude    ?? null,
        longitude:    old?.longitude   ?? null,
        locationName: old?.locationName ?? null,
        forcedWeather: null,
    });

    await clockMsg.edit(formatClockMessage(clock, rpgDate, null));

    const velText = velocity !== 1 ? ` | Velocidade: ${velocity}x` : '';
    return message.reply(`✅ Relógio **${name}** configurado para **${dateStr} às ${timeStr}**${velText} em ${targetCh}.`);
}

// ─── rp!tempo skip <Nome> <Quantidade> ────────────────────────────────────────
// Avança ou recua o tempo RP de um relógio
export async function handleSkip(message: Message, args: string[]) {
    const name   = args[1];
    const rawAmt = args[2];

    if (!name || !rawAmt) {
        return message.reply('⚠️ **Uso:** `rp!tempo skip <Nome> <Tempo>`\nEx: `rp!tempo skip Seattle 2h`');
    }

    const amount = parseTimeStr(rawAmt);
    if (amount === 0) return message.reply('❌ Tempo inválido. Use `Xm`, `Xh` ou `Xd`.');

    const clock = await ClockModel.findOne({ name, guildId: message.guild!.id });
    if (!clock) return message.reply(`❌ Relógio **${name}** não encontrado neste servidor.`);

    const now     = Date.now();
    const current = clock.anchorRPG + (now - clock.anchorReal) * clock.velocity;

    clock.anchorReal = now;
    clock.anchorRPG  = current + amount;
    await clock.save();

    const newDate = new Date(clock.anchorRPG);
    const fmt     = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' }).format(newDate);
    return message.reply(`⏩ **${name}** avançou ${rawAmt}. Novo horário RP: **${fmt}**.`);
}

// ─── rp!tempo pause <Nome> / rp!tempo resume <Nome> ──────────────────────────
export async function handlePause(message: Message, args: string[], pause: boolean) {
    const name = args[1];
    if (!name) return message.reply(`⚠️ **Uso:** \`rp!tempo ${pause ? 'pause' : 'resume'} <Nome>\``);

    const clock = await ClockModel.findOne({ name, guildId: message.guild!.id });
    if (!clock) return message.reply(`❌ Relógio **${name}** não encontrado.`);

    if (pause) {
        // Ao pausar, cristaliza a âncora no momento atual para não "perder" tempo
        const now = Date.now();
        clock.anchorRPG  = clock.anchorRPG + (now - clock.anchorReal) * clock.velocity;
        clock.anchorReal = now;
    }

    clock.paused = pause;
    await clock.save();

    return message.reply(pause
        ? `⏸️ Relógio **${name}** pausado. O tempo RP está congelado.`
        : `▶️ Relógio **${name}** retomado.`,
    );
}

// ─── rp!tempo delete <Nome> ────────────────────────────────────────────────────
export async function handleDelete(message: Message, args: string[]) {
    const name = args[1];
    if (!name) return message.reply('⚠️ **Uso:** `rp!tempo delete <Nome>`');

    if (!message.guild!.members.cache.get(message.author.id)?.permissions.has('ManageChannels')) {
        return message.reply('❌ Você precisa de permissão **Gerenciar Canais** para deletar relógios.');
    }

    const res = await ClockModel.deleteOne({ name, guildId: message.guild!.id });
    if (res.deletedCount === 0) return message.reply(`❌ Relógio **${name}** não encontrado.`);

    return message.reply(`🗑️ Relógio **${name}** deletado.`);
}

// ─── rp!tempo list ────────────────────────────────────────────────────────────
export async function handleList(message: Message) {
    const clocks = await ClockModel.find({ guildId: message.guild!.id });

    if (clocks.length === 0) {
        return message.reply('📭 Nenhum relógio ativo neste servidor.\nUse `rp!tempo #canal` para criar um.');
    }

    const lines = clocks.map(c => {
        const rpg = computeRPGTime(c);
        const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' }).format(rpg);
        const loc = c.locationName ? ` | 📍 ${c.locationName}` : '';
        const vel = c.velocity !== 1 ? ` | ⏩ ${c.velocity}x` : '';
        const paused = c.paused ? ' ⏸️' : '';
        return `▸ **${c.name}**${paused} — \`${fmt}\`${loc}${vel} — <#${c.channelId}>`;
    });

    return message.reply(`🕰️ **Relógios ativos neste servidor (${clocks.length}):**\n${lines.join('\n')}`);
}

// ─── rp!tempo info <Nome> ────────────────────────────────────────────────────
export async function handleInfo(message: Message, args: string[]) {
    const name = args[1];
    if (!name) return message.reply('⚠️ **Uso:** `rp!tempo info <Nome>`');

    const clock = await ClockModel.findOne({ name, guildId: message.guild!.id });
    if (!clock) return message.reply(`❌ Relógio **${name}** não encontrado.`);

    const rpg      = computeRPGTime(clock);
    const fmtFull  = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }).format(rpg);

    const lines = [
        `🕰️ **Relógio: ${clock.name}**`,
        `📅 **Hora RP:** ${fmtFull}`,
        `📺 **Canal:** <#${clock.channelId}>`,
        `⏩ **Velocidade:** ${clock.velocity}x (${clock.velocity === 1 ? 'tempo real' : `1 ms real = ${clock.velocity} ms RP`})`,
        `📡 **Localização:** ${clock.locationName ?? 'não definida — use `rp!clima sync`'}`,
        `🌦️ **Clima forçado:** ${clock.forcedWeather ?? 'automático'}`,
        `⏸️ **Status:** ${clock.paused ? 'PAUSADO' : 'em andamento'}`,
    ];

    return message.reply(lines.join('\n'));
}