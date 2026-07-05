// RPTool/supercommands/tempo/handlers/clock.ts
// CRUD completo dos relógios RP
import { Message, TextChannel } from 'discord.js';
import { ClockModel, IClock } from '../../../tools/models/ClockSchema';
import { formatClockMessage, computeRPGTime } from '../clockEngine';

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

// ─── Busca relógio por nome exato (case-insensitive), escopado ao servidor ───
export async function findClockByName(guildId: string, name: string): Promise<IClock | null> {
    const clocks = await ClockModel.find({ guildId });
    const target = name.trim().toLowerCase();
    return clocks.find((c: IClock) => c.name.toLowerCase() === target) ?? null;
}

// ─── Resolve relógio cujo nome pode ter espaços ───────────────────────────────
// Nomes com espaço ("São Paulo") não podem ser lidos de args[1]: compara os
// tokens com os nomes reais no banco e devolve o relógio + os args restantes.
// Se mais de um nome casar, o mais longo vence.
export async function resolveClock(guildId: string, tokens: string[]): Promise<{ clock: IClock; rest: string[] } | null> {
    const clocks = await ClockModel.find({ guildId });
    let best: { clock: IClock; used: number } | null = null;

    for (const clock of clocks as IClock[]) {
        const nameTokens = clock.name.split(/\s+/);
        if (nameTokens.length === 0 || nameTokens.length > tokens.length) continue;
        const candidate = tokens.slice(0, nameTokens.length).join(' ').toLowerCase();
        if (candidate === clock.name.toLowerCase() && (!best || nameTokens.length > best.used)) {
            best = { clock, used: nameTokens.length };
        }
    }

    return best ? { clock: best.clock, rest: tokens.slice(best.used) } : null;
}

// ─── Apaga (best-effort) a mensagem fixa de um relógio no Discord ─────────────
// Sem isso, substituir/deletar um relógio deixa a mensagem antiga congelada
// no canal para sempre.
async function deleteClockMessage(message: Message, clock: IClock): Promise<void> {
    try {
        const ch  = await message.client.channels.fetch(clock.channelId).catch(() => null) as TextChannel | null;
        const msg = ch ? await ch.messages.fetch(clock.messageId).catch(() => null) : null;
        if (msg) await msg.delete().catch(() => {});
    } catch { /* best-effort: canal/mensagem podem não existir mais */ }
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

    // Nome pode ter espaços: tudo depois do #canal é o nome
    let name = args.slice(1).join(' ').trim();
    // Usuários copiam o "[Nome]" da ajuda ao pé da letra — remove colchetes externos
    if (name.startsWith('[') && name.endsWith(']')) name = name.slice(1, -1).trim();

    if (!message.guild!.members.cache.get(message.author.id)?.permissions.has('ManageChannels')) {
        return message.reply('❌ Você precisa de permissão **Gerenciar Canais** para criar relógios.');
    }

    const guildId = message.guild!.id;

    // Sem nome: não cria AUTO por cima de um canal que já tem relógio
    if (!name) {
        const existing = await ClockModel.findOne({ guildId, channelId: cid });
        if (existing) {
            return message.reply(
                `⚠️ O canal ${ch} já tem o relógio **${existing.name}**.\n` +
                `Use \`rp!tempo info ${existing.name}\`, \`rp!tempo set ${existing.name} ...\` ou \`rp!tempo delete ${existing.name}\`.`,
            );
        }
        name = `AUTO_${cid}`;
    } else {
        // Nome já existe → MOVE o relógio para o canal preservando toda a
        // configuração (data RP, velocidade, clima). Antes, recriar do zero
        // destruía silenciosamente o relógio configurado.
        const previous = await findClockByName(guildId, name);
        if (previous) {
            const clockMsg = await ch.send('⏳ Movendo relógio...');
            await deleteClockMessage(message, previous);
            previous.channelId = cid;
            previous.messageId = clockMsg.id;
            await previous.save();
            await clockMsg.edit(formatClockMessage(previous, computeRPGTime(previous), null));
            return message.reply(`📌 Relógio **${previous.name}** movido para ${ch} (data/hora RP e configurações preservadas).`);
        }
    }

    // Remove o AUTO_ antigo do canal (e sua mensagem), escopado ao servidor
    const oldAuto = await ClockModel.findOne({ guildId, name: `AUTO_${cid}` });
    if (oldAuto) {
        await deleteClockMessage(message, oldAuto);
        await ClockModel.deleteOne({ _id: oldAuto._id });
    }

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

    return message.reply(`✅ Relógio **${name}** criado em ${ch}.\nUse \`rp!tempo set ${name} <DD/MM/AAAA> <HH:MM>\` para configurar data/hora RP.\nEx: \`rp!tempo set ${name} 01/01/2005 15:30\``);
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

    // Detecta onde está o #canal escaneando todos os args (suporta nomes com espaços)
    const chanIdx = args.findIndex((a, i) => i >= 1 && a.startsWith('<#'));
    if (chanIdx !== -1) {
        name    = args.slice(1, chanIdx).join(' ');
        const cid = args[chanIdx].replace(/[<#>]/g, '');
        const ch  = message.guild?.channels.cache.get(cid) as TextChannel | undefined;
        if (ch) targetCh = ch;
        dateStr  = args[chanIdx + 1] ?? '';
        timeStr  = args[chanIdx + 2] ?? '';
        modsStart = chanIdx + 3;
    } else {
        // Sem #canal: o nome vai até o token de data (DD/MM/AAAA)
        const dateIdx = args.findIndex((a, i) => i >= 2 && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(a));
        if (dateIdx === -1) {
            name = args[1] ?? ''; dateStr = args[2] ?? ''; timeStr = args[3] ?? ''; modsStart = 4;
        } else {
            name      = args.slice(1, dateIdx).join(' ');
            dateStr   = args[dateIdx];
            timeStr   = args[dateIdx + 1] ?? '';
            modsStart = dateIdx + 2;
        }
    }

    // Valida formato ANTES de parsear — senão "set meu pai de calcinha" tenta
    // ler "pai" como data e responde um confuso "Data ou hora inválida"
    const dateOk = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateStr);
    const timeOk = /^\d{1,2}:\d{2}$/.test(timeStr);
    if (!name || !dateOk || !timeOk) {
        return message.reply(
            '⚠️ **Uso:** `rp!tempo set <Nome> [#canal] <DD/MM/AAAA> <HH:MM> [+ Xm -> Yh]`\n' +
            'Ex: `rp!tempo set Seattle 01/01/2005 15:30 + 1m -> 10m`\n' +
            '-# A data e a hora são obrigatórias.',
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

    // Preserva geo se já existia (busca escopada ao servidor) e apaga a
    // mensagem antiga para não deixar um relógio congelado no canal
    const old = await findClockByName(message.guild!.id, name);
    if (old) {
        await deleteClockMessage(message, old);
        await ClockModel.deleteOne({ _id: old._id });
    }

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
    if (args.length < 3) {
        return message.reply('⚠️ **Uso:** `rp!tempo skip <Nome> <Tempo>`\nEx: `rp!tempo skip Seattle 2h`');
    }

    // O último arg é o tempo; o nome (pode ter espaços) é resolvido contra o banco
    const resolved = await resolveClock(message.guild!.id, args.slice(1));
    if (!resolved || resolved.rest.length !== 1) {
        return message.reply(`❌ Relógio **${args.slice(1, -1).join(' ')}** não encontrado neste servidor.\nUse \`rp!tempo list\` para ver os nomes.`);
    }

    const { clock, rest } = resolved;
    const rawAmt = rest[0];
    const name   = clock.name;

    const amount = parseTimeStr(rawAmt);
    if (amount === 0) return message.reply('❌ Tempo inválido. Use `Xm`, `Xh` ou `Xd`.');

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
    const name = args.slice(1).join(' ');
    if (!name) return message.reply(`⚠️ **Uso:** \`rp!tempo ${pause ? 'pause' : 'resume'} <Nome>\``);

    const clock = await findClockByName(message.guild!.id, name);
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
    const name = args.slice(1).join(' ');
    if (!name) return message.reply('⚠️ **Uso:** `rp!tempo delete <Nome>`');

    if (!message.guild!.members.cache.get(message.author.id)?.permissions.has('ManageChannels')) {
        return message.reply('❌ Você precisa de permissão **Gerenciar Canais** para deletar relógios.');
    }

    const clock = await findClockByName(message.guild!.id, name);
    if (!clock) return message.reply(`❌ Relógio **${name}** não encontrado.`);

    await deleteClockMessage(message, clock);
    await ClockModel.deleteOne({ _id: clock._id });
    return message.reply(`🗑️ Relógio **${clock.name}** deletado.`);
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
    const name = args.slice(1).join(' ');
    if (!name) return message.reply('⚠️ **Uso:** `rp!tempo info <Nome>`');

    const clock = await findClockByName(message.guild!.id, name);
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