// RPTool/supercommands/exportchat/modules/textMerger.ts
// ─── Merger de segmentos → arquivos de output .txt (modo `readable`) ─────────
// Mesma ideia do merger.ts (concatena seg_YYYYMMDD.txt em ordem cronológica e
// divide em partes de 7.5 MB), sem header/CSS/footer de HTML. O cabeçalho aqui
// são 4 linhas de `#` explicando o formato — a IA que ler o arquivo já começa
// sabendo como interpretar cada linha.

import fs   from 'fs';
import path from 'path';
import { listSegmentFiles } from './cleanup';

const MAX_BYTES = 7.5 * 1024 * 1024; // 7.5 MB com margem abaixo dos 8 MB do Discord

export interface MergeResult {
    outputFiles: string[];
    totalParts:  number;
}

function txtHeader(channelName: string, subtitle: string, part: number, total: number): string {
    return (
        `# Canal: #${channelName} — Parte ${part}/${total}\n` +
        `# ${subtitle}\n` +
        `# Formato: Nick, HH:MM - mensagem   |   linhas "===== DD/MM/AAAA =====" separam os dias\n` +
        `# Marcadores entre [* *] indicam conteúdo não-textual (imagem, anexo, embed, resposta)\n\n`
    );
}

export async function mergeTextSegments(
    sessionPath: string,
    channelName: string,
    subtitle:    string,
): Promise<MergeResult> {
    const segFiles = listSegmentFiles(sessionPath, 'txt');
    const outputFiles: string[] = [];

    let partIndex    = 1;
    let currentBody  = '';
    let currentBytes = 0;

    // I/O assíncrono: writes de 7,5 MB síncronos travam o event loop do bot todo.
    const flushPart = async (totalParts: number) => {
        const outPath = path.join(sessionPath, `output_${String(partIndex).padStart(4, '0')}.txt`);
        await fs.promises.writeFile(outPath, txtHeader(channelName, subtitle, partIndex, totalParts) + currentBody, 'utf8');
        outputFiles.push(outPath);
        partIndex++;
        currentBody  = '';
        currentBytes = 0;
    };

    // Pré-cálculo do número de partes (o header precisa do total antes da escrita)
    let totalBytes = 0;
    for (const segFile of segFiles) {
        const st = await fs.promises.stat(segFile).catch(() => null);
        if (st) totalBytes += st.size;
    }
    const estimatedParts = Math.max(1, Math.ceil(totalBytes / MAX_BYTES));

    for (const segFile of segFiles) {
        const segContent = await fs.promises.readFile(segFile, 'utf8').catch(() => null);
        if (segContent === null) continue;
        const segBytes = Buffer.byteLength(segContent, 'utf8');

        if (currentBytes + segBytes > MAX_BYTES && currentBody.length > 0) {
            await flushPart(estimatedParts);
        }

        // Um único dia maior que o limite é dividido por linha — nunca no meio
        // de uma linha, senão uma mensagem sairia partida entre dois arquivos.
        if (segBytes > MAX_BYTES) {
            for (const line of segContent.split(/(?<=\n)/)) {
                const lineBytes = Buffer.byteLength(line, 'utf8');
                if (currentBytes + lineBytes > MAX_BYTES && currentBody.length > 0) {
                    await flushPart(estimatedParts);
                }
                currentBody  += line;
                currentBytes += lineBytes;
            }
        } else {
            currentBody  += segContent;
            currentBytes += segBytes;
        }
    }

    if (currentBody.length > 0) {
        await flushPart(estimatedParts);
    }

    if (outputFiles.length === 0) {
        const outPath = path.join(sessionPath, 'output_0001.txt');
        await fs.promises.writeFile(outPath, txtHeader(channelName, subtitle, 1, 1) + 'Nenhuma mensagem encontrada.\n', 'utf8');
        outputFiles.push(outPath);
    }

    // Corrige o total nos headers se a estimativa errou
    const realTotal = outputFiles.length;
    if (realTotal !== estimatedParts) {
        for (const file of outputFiles) {
            const content = await fs.promises.readFile(file, 'utf8');
            const fixed   = content.replace(
                new RegExp(`^# Canal: (.*) — Parte (\\d+)/${estimatedParts}$`, 'm'),
                `# Canal: $1 — Parte $2/${realTotal}`,
            );
            await fs.promises.writeFile(file, fixed, 'utf8');
        }
    }

    return { outputFiles, totalParts: realTotal };
}
