// RPTool/supercommands/resumo/modules/text.ts
// Formatação e higiene de texto que entra em embed.
import { LIMITE_FIELD } from '../config';

export function truncar(text: string, max: number = LIMITE_FIELD): string {
    if (!text) return text;
    return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

// A IA reproduz o que leu — inclusive @everyone e pings de cargo vindos do log.
// Trocamos por homóglifos/zero-width: continua legível, mas não notifica ninguém.
export function sanitizeOutput(text: string): string {
    if (!text) return text;
    return text
        .replace(/@everyone/g, '@everyоne')
        .replace(/@here/g, '@hеre')
        .replace(/<@&(\d+)>/g, '<@&​$1>');
}
