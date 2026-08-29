// RPTool/supercommands/tempo/handlers/convert.ts
// Conversão de tempo: IRL ↔ RP e contagem de mensagens → tempo RP
import { Message } from 'discord.js';
import { parseTimeStr, resolveClock } from './clock';

// ─── rp!tempo conv <Nome> <Xm -> Yh> ─────────────────────────────────────────
// Exibe quanto tempo RP corresponde a uma quantidade de tempo real,
// dado a velocidade atual do relógio
export async function handleConvert(message: Message, args: string[]) {
    // Modo 1: rp!tempo conv <Nome> <Xm -> Yh>   (redefine a velocidade)
    // Modo 2: rp!tempo conv <Nome> <Xm>          (calcula com a velocidade atual)
    // Modo 3: rp!tempo conv <Xm -> Yh>           (converte sem relógio)

    const hasArrow = args.includes('->');

    if (!hasArrow && args.length < 2) {
        return message.reply(
            '⚠️ **Uso:**\n' +
            '`rp!tempo conv <Tempo Real>` — converte na escala 1:1\n' +
            '`rp!tempo conv <Tempo Real> -> <Tempo RP>` — mostra o multiplicador\n' +
            '`rp!tempo conv <Nome> <Tempo Real>` — calcula com a velocidade do relógio',
        );
    }

    // Sem relógio: conversão direta
    if (hasArrow) {
        const arrowIdx  = args.indexOf('->');
        const fromMs    = parseTimeStr(args[arrowIdx - 1]);
        const toMs      = parseTimeStr(args[arrowIdx + 1]);

        if (!fromMs || !toMs) return message.reply('❌ Formato inválido. Ex: `1m -> 10m`');

        const mult = toMs / fromMs;
        return message.reply(
            `⏱️ **Conversão:**\n` +
            `${formatDuration(fromMs)} real = ${formatDuration(toMs)} RP\n` +
            `Multiplicador: **${mult}x**\n` +
            `*(1 hora real = ${formatDuration(fromMs === 0 ? 0 : toMs / fromMs * 3_600_000)} RP)*`,
        );
    }

    // Com relógio: o último arg é o tempo, o resto é o nome (pode ter espaços)
    if (args.length < 3) {
        return message.reply('⚠️ **Uso:** `rp!tempo conv <Nome do Relógio> <Tempo Real>`\nEx: `rp!tempo conv Seattle 30m`');
    }

    const resolved = await resolveClock(message.guild!.id, args.slice(1));
    if (!resolved || resolved.rest.length !== 1) {
        return message.reply(`❌ Relógio **${args.slice(1, -1).join(' ')}** não encontrado.\nUse \`rp!tempo list\` para ver os nomes.`);
    }

    const { clock, rest } = resolved;

    const realMs = parseTimeStr(rest[0]);
    if (!realMs) return message.reply('❌ Tempo inválido. Use `Xm`, `Xh` ou `Xd`.');

    const rpMs = realMs * clock.velocity;

    return message.reply(
        `⏱️ **${clock.name}** — Conversão:\n` +
        `${formatDuration(realMs)} real = **${formatDuration(rpMs)} RP**\n` +
        `*(Velocidade atual: ${clock.velocity}x)*`,
    );
}

// ─── rp!tempo msg <Nome> <N mensagens> [por <Tempo>] ─────────────────────────
// Calcula quanto tempo RP passa em um canal a cada N mensagens
// Ex: rp!tempo msg Seattle 1 msg por 5m   → 1 mensagem = 5 minutos RP
export async function handleMsgRate(message: Message, args: string[]) {
    // Argumentos esperados (após o nome, que pode ter espaços):
    //   <N mensagens> ["msg"|"mensagens"] ["por"|"->"] <duração RP>

    if (args.length < 3) {
        return message.reply(
            '⚠️ **Uso:** `rp!tempo msg <Nome> <N> <Tempo RP por mensagem>`\n' +
            'Ex: `rp!tempo msg Seattle 1 5m` — cada mensagem no canal = 5 min RP',
        );
    }

    const resolved = await resolveClock(message.guild!.id, args.slice(1));
    if (!resolved) {
        return message.reply(`❌ Relógio não encontrado em **${args.slice(1).join(' ')}**.\nUse \`rp!tempo list\` para ver os nomes.`);
    }

    const { clock, rest } = resolved;
    const countStr = rest[0];
    const durStr   = rest[rest.length - 1]; // pega sempre o último argumento como duração
    const name     = clock.name;

    if (!countStr || !durStr || countStr === durStr) {
        return message.reply(
            '⚠️ **Uso:** `rp!tempo msg <Nome> <N> <Tempo RP por mensagem>`\n' +
            'Ex: `rp!tempo msg Seattle 1 5m` — cada mensagem no canal = 5 min RP',
        );
    }

    const msgCount = parseInt(countStr, 10);
    const rpPerMsg = parseTimeStr(durStr);

    if (isNaN(msgCount) || msgCount < 1) return message.reply('❌ Número de mensagens inválido.');
    if (!rpPerMsg)                        return message.reply('❌ Duração inválida. Use `Xm`, `Xh` ou `Xd`.');

    // Para que cada N mensagens = dur RP, a velocidade precisa ser:
    // realTime = tempo médio entre N mensagens (não temos isso, então explicamos a relação)
    const rpPerMsgFmt = formatDuration(rpPerMsg);

    return message.reply(
        `💬 **Taxa de mensagens — ${name}:**\n` +
        `**${msgCount}** mensagem${msgCount > 1 ? 'ns' : ''} = **${rpPerMsgFmt}** de tempo RP\n\n` +
        `Para aplicar isso como velocidade, use:\n` +
        `\`rp!tempo set ${name} [data] [hora] + ${msgCount === 1 ? durStr : `${msgCount}msg -> ${durStr}`}\`\n\n` +
        `> *Dica: configure \`rp!tempo set\` com \`+ 1m -> ${durStr}\` se 1 minuto de chat real = ${rpPerMsgFmt} RP.*`,
    );
}

// ─── Formata ms em texto legível ("2h 30m", "45m", "3d 12h") ─────────────────
export function formatDuration(ms: number): string {
    if (ms <= 0) return '0s';
    const abs  = Math.abs(ms);
    const days = Math.floor(abs  / 86_400_000);
    const hrs  = Math.floor((abs % 86_400_000) / 3_600_000);
    const mins = Math.floor((abs % 3_600_000)  / 60_000);
    const secs = Math.floor((abs % 60_000)     / 1000);

    const parts: string[] = [];
    if (days) parts.push(`${days}d`);
    if (hrs)  parts.push(`${hrs}h`);
    if (mins) parts.push(`${mins}m`);
    if (secs && !days && !hrs) parts.push(`${secs}s`);
    return parts.join(' ') || '< 1s';
}