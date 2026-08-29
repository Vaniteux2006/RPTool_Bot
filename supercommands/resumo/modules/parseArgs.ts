// RPTool/supercommands/resumo/modules/parseArgs.ts
// ─── Parse dos argumentos ────────────────────────────────────────────────────
// O comando não tem subcomandos de verdade: tudo depois de `rp!resumo` é canal,
// flag ou intervalo de datas. Este módulo transforma isso num objeto único.
import { Message, TextChannel } from 'discord.js';
import { JANELA_PADRAO_MS, TOKENS_AJUDA, TOKENS_PULAR } from '../config';
import { parseBRDate } from '../../../tools/utils/date';

export interface ArgsResumo {
    canal: TextChannel;
    inicio: Date;
    fim: Date;
    pularConfirmacao: boolean;
    ajuda: boolean;
    erro?: string;
}

// Discord IDs são timestamp-based: dá pra pular direto para o ponto do histórico
// sem varrer o canal inteiro (o `before` do fetch aceita snowflake sintético).
export function dateToSnowflake(date: Date): string {
    const epoch = 1420070400000n;
    const timestamp = BigInt(date.getTime());
    const snowflake = (timestamp - epoch) << 22n;
    return snowflake.toString();
}

// Aceita DD/MM, DD/MM/AAAA e qualquer um dos dois com HH:MM.
// ⚠️ MUDANÇA CONSCIENTE (v1.6): antes montava a data em FUSO LOCAL, deslocando a
// janela em ~3h vs. o resto do pipeline de estatística (todo em UTC). Agora usa
// o parser único (tools/utils/date.ts), sempre UTC e com validação de overflow.
export function parseCustomDate(dateStr: string): Date | null {
    return parseBRDate(dateStr, { comHora: true });
}

export function parseArgs(message: Message, args: string[]): ArgsResumo {
    let canal = message.channel as TextChannel;
    let resto = args;

    if (message.mentions.channels.first()) {
        canal = message.mentions.channels.first() as TextChannel;
        resto = resto.filter(a => !a.startsWith('<#'));
    }

    // Escape hatch da confirmação de custo: preserva o fluxo "manda e esquece"
    // em períodos grandes, onde a confirmação travaria esperando um clique.
    const pularConfirmacao = resto.some(a => TOKENS_PULAR.has(a.toLowerCase()));
    resto = resto.filter(a => !TOKENS_PULAR.has(a.toLowerCase()));

    const ajuda = TOKENS_AJUDA.has((resto[0] ?? '').toLowerCase());

    let fim = new Date();
    let inicio = new Date(fim.getTime() - JANELA_PADRAO_MS);

    const bruto = resto.join(' ');

    if (bruto.includes('->')) {
        const [inicioStr, fimStr] = bruto.split('->');
        const parsedInicio = parseCustomDate(inicioStr);
        const parsedFim = parseCustomDate(fimStr);
        if (parsedInicio) inicio = parsedInicio;
        if (parsedFim) fim = parsedFim;
        // Só a data inicial: o intervalo é o dia inteiro dela (em UTC, como o parser).
        else if (parsedInicio) { fim = new Date(parsedInicio); fim.setUTCHours(23, 59, 59); }
    } else if (bruto.trim() !== '') {
        const dia = parseCustomDate(bruto);
        if (dia) {
            inicio = new Date(dia); inicio.setUTCHours(0, 0, 0);
            fim = new Date(dia); fim.setUTCHours(23, 59, 59);
        }
    }

    const erro = inicio > fim ? '❌ A data de início não pode ser depois da data de fim.' : undefined;

    return { canal, inicio, fim, pularConfirmacao, ajuda, erro };
}
