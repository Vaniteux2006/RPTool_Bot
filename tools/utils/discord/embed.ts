// RPTool/tools/utils/discord/embed.ts
// ─── Truncagem segura para embeds ────────────────────────────────────────────
// `.slice(0, 1024)` cru corta no meio da palavra e pode partir markdown ao meio
// — um ** órfão quebra a renderização do embed inteiro. truncarCampo fecha os
// marcadores abertos e corta em fronteira de palavra.
import { AttachmentBuilder } from 'discord.js';

/** Trunca para caber num field de embed (default 1024), sem partir palavra nem markdown. */
export function truncarCampo(texto: string, max = 1024): string {
    if (!texto || texto.length <= max) return texto;

    const reticencias = '…';
    let corte = max - reticencias.length;

    // Reserva espaço para fechar marcadores que ficarem abertos (pior caso: *** + ``)
    corte -= 8;

    let out = texto.slice(0, Math.max(0, corte));

    // Prefere cortar em fronteira de palavra (sem perder mais que ~20 chars)
    const ultimoEspaco = out.lastIndexOf(' ');
    if (ultimoEspaco > corte - 20) out = out.slice(0, ultimoEspaco);

    // Fecha marcadores desequilibrados (ordem: crase > negrito > itálico > riscado > spoiler)
    const conta = (re: RegExp) => (out.match(re) || []).length;
    if (conta(/```/g) % 2 === 1) out += '```';
    else if (conta(/(?<!`)`(?!`)/g) % 2 === 1) out += '`';
    if (conta(/\*\*/g) % 2 === 1) out += '**';
    if (conta(/(?<!\*)\*(?!\*)/g) % 2 === 1) out += '*';
    if (conta(/~~/g) % 2 === 1) out += '~~';
    if (conta(/\|\|/g) % 2 === 1) out += '||';

    return out + reticencias;
}

/**
 * Field de embed OU anexo: se o texto não cabe em `max`, vira arquivo anexado
 * (padrão do textUtils.formatLongContent, que quase ninguém usava).
 */
export function campoOuAnexo(texto: string, nomeArquivo: string, max = 1024): { text: string; files: AttachmentBuilder[] } {
    const files: AttachmentBuilder[] = [];
    let text = texto?.trim() || '*Mensagem vazia/Apenas mídia*';

    if (text.length > max) {
        files.push(new AttachmentBuilder(Buffer.from(texto, 'utf-8'), { name: nomeArquivo }));
        text = `⚠️ **Texto muito longo!** O conteúdo completo foi anexado no arquivo \`${nomeArquivo}\` acima.`;
    }
    return { text, files };
}
