// RPTool/supercommands/exportchat/modules/merger.ts
// ─── Merger de segmentos → arquivos de output HTML ────────────────────────────
// Lê os arquivos de segmento em ordem cronológica (por nome, que é YYYYMMDD),
// concatena os corpos HTML e divide em arquivos de saída de 7.5 MB.
// Header/CSS/footer só são adicionados nos arquivos de saída — nunca nos segmentos.

import fs   from 'fs';
import path from 'path';
import { listSegmentFiles } from './cleanup';
import { htmlHeader, HTML_FOOTER } from '../../../tools/HtmlTranscript';

const MAX_BYTES = 7.5 * 1024 * 1024; // 7.5 MB com margem abaixo dos 8 MB do Discord

export interface MergeResult {
    outputFiles: string[];
    totalParts:  number;
}

export async function mergeSegments(
    sessionPath:  string,
    channelName:  string,
    subtitle:     string,
): Promise<MergeResult> {
    const segFiles   = listSegmentFiles(sessionPath);
    const outputFiles: string[] = [];

    let partIndex    = 1;
    let currentBody  = '';
    let currentBytes = 0;

    // I/O 100% assíncrono (fs.promises): reads/writes de até 7,5 MB síncronos
    // travavam o event loop do bot inteiro quando havia exports concorrentes.
    const flushPart = async (totalParts: number) => {
        // totalParts não é conhecido no início — usamos 0 como placeholder
        // e renomeamos depois (ou aceitamos "Parte N" sem total)
        const header   = htmlHeader(channelName, subtitle, partIndex, totalParts);
        const fullHtml = header + currentBody + HTML_FOOTER;
        const outPath  = path.join(sessionPath, `output_${String(partIndex).padStart(4, '0')}.html`);
        await fs.promises.writeFile(outPath, fullHtml, 'utf8');
        outputFiles.push(outPath);
        partIndex++;
        currentBody  = '';
        currentBytes = 0;
    };

    // Pré-calcula o tamanho total para saber o número de partes
    // (aproximado — lemos uma vez pra estimar, depois lemos de novo pra escrever)
    let totalBytes = 0;
    for (const segFile of segFiles) {
        const st = await fs.promises.stat(segFile).catch(() => null);
        if (st) totalBytes += st.size;
    }
    const estimatedParts = Math.max(1, Math.ceil(totalBytes / MAX_BYTES));

    // Leitura e split em partes
    for (const segFile of segFiles) {
        const segContent = await fs.promises.readFile(segFile, 'utf8').catch(() => null);
        if (segContent === null) continue;
        const segBytes   = Buffer.byteLength(segContent, 'utf8');

        // Se adicionar este segmento estourar o limite, fecha a parte atual primeiro
        if (currentBytes + segBytes > MAX_BYTES && currentBody.length > 0) {
            await flushPart(estimatedParts);
        }

        // Segmentos maiores que MAX_BYTES sozinhos são divididos por linha de grupo
        if (segBytes > MAX_BYTES) {
            const groups = segContent.split(/(?=<div class="grp)/);
            for (const group of groups) {
                const groupBytes = Buffer.byteLength(group, 'utf8');
                if (currentBytes + groupBytes > MAX_BYTES && currentBody.length > 0) {
                    await flushPart(estimatedParts);
                }
                currentBody  += group;
                currentBytes += groupBytes;
            }
        } else {
            currentBody  += segContent;
            currentBytes += segBytes;
        }
    }

    // Flush da última parte
    if (currentBody.length > 0) {
        await flushPart(estimatedParts);
    }

    // Se não gerou nada (todos os segmentos estavam vazios)
    if (outputFiles.length === 0) {
        const header  = htmlHeader(channelName, subtitle, 1, 1);
        const outPath = path.join(sessionPath, 'output_0001.html');
        await fs.promises.writeFile(outPath, header + '<p style="color:#949ba4;padding:20px">Nenhuma mensagem encontrada.</p>' + HTML_FOOTER, 'utf8');
        outputFiles.push(outPath);
    }

    // Reescreve o header com o total de partes real (corrige o estimatedParts se errou)
    const realTotal = outputFiles.length;
    if (realTotal !== estimatedParts) {
        for (let i = 0; i < outputFiles.length; i++) {
            const content    = await fs.promises.readFile(outputFiles[i], 'utf8');
            // Substitui o total no título: "Parte N/X" onde X era estimatedParts
            const fixed      = content.replace(
                new RegExp(`— Parte (\\d+)/${estimatedParts}`),
                `— Parte $1/${realTotal}`,
            );
            await fs.promises.writeFile(outputFiles[i], fixed, 'utf8');
        }
    }

    return { outputFiles, totalParts: realTotal };
}
