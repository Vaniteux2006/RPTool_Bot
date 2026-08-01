// RPTool/supercommands/resumo/modules/text.ts
// Formatação e higiene de texto que entra em embed.
import { LIMITE_FIELD } from '../config';

export function truncar(text: string, max: number = LIMITE_FIELD): string {
    if (!text) return text;
    return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

// Fonte única da higiene anti-ping: tools/utils/text.ts.
export { sanitizeOutput } from '../../../tools/utils/text';
