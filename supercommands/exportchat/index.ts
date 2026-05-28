// RPTool/supercommands/exportchat/index.ts
// ─── Exportação de Chat para HTML — v2 (workers paralelos + disco) ────────────
//
// Arquitetura:
//   1. parseArgs    → valida canal + intervalo → buildDayQueue (fila de dias)
//   2. confirm      → botão de confirmação se > 10 mensagens estimadas
//   3. 3 workers    → consomem a fila de dias em paralelo, escrevem seg_YYYYMMDD.html em /data
//   4. merger       → concatena segmentos em ordem → divide em arquivos de 7.5 MB
//   5. Envia HTMLs  → DM do usuário, parte por parte
//   6. cleanup      → deleta a pasta de sessão do disco
//
// RAM: O(mensagens de 1 batch de 100) — sem acumular em memória.
// Disco: O(tamanho total do export) em /data/session_<userId>_<ts>/ — limpo após envio.

import {
    Message, TextChannel, AttachmentBuilder,
} from 'discord.js';
import path from 'path';

import { parseChannel, parseTimeRange, buildDayQueue } from './modules/parseArgs';
import { createSessionDir, deleteSession, cleanOrphanSessions } from './modules/cleanup';
import { ProgressTracker }  from './modules/ProgressTracker';
import { SegmentRenderer }  from './modules/SegmentRenderer';
import { runWorker }        from './modules/worker';
import { mergeSegments }    from './modules/merger';
import { askConfirmation }  from './modules/confirm';
import { scanActiveDays }   from './modules/Scanner';

// ─── Limpeza de sessões órfãs no boot ────────────────────────────────────────
cleanOrphanSessions(4);

// ─── Safe reply/edit (guard para PartialGroupDMChannel) ──────────────────────
async function safeReply(message: Message, content: string): Promise<Message> {
    try {
        return await message.reply(content);
    } catch {
        const ch = message.channel;
        if (!('send' in ch) || typeof (ch as any).send !== 'function') return message;
        return await (ch as any).send(`<@${message.author.id}> ${content}`) as Message;
    }
}

async function safeEdit(msg: Message, content: string): Promise<void> {
    try {
        await msg.edit(content);
    } catch {
        const ch = msg.channel;
        if (!('send' in ch) || typeof (ch as any).send !== 'function') return;
        await (ch as any).send(content).catch(() => {});
    }
}

// ─── Estado de cancelamento por usuário ──────────────────────────────────────
const activeExports = new Map<string, boolean>();

// ─── Comando ──────────────────────────────────────────────────────────────────
export default {
    name:        'exportchat',
    description: 'Exporta mensagens de um canal para HTML (workers paralelos).',
    aliases:     ['exportar', 'backupchat'],

    async execute(message: Message, args: string[]) {
        if (!message.guild) return message.reply('❌ Este comando só funciona em servidores.');

        // ── 1. Parsear canal ──────────────────────────────────────────────────
        if (!args.length) {
            return safeReply(message,
                '❌ Uso: `rp!exportchat #canal`\n' +
                'Com intervalo: `rp!exportchat #canal DD/MM/AAAA -> DD/MM/AAAA`\n' +
                'Com hora: `rp!exportchat #canal HH:MM DD/MM/AAAA -> HH:MM DD/MM/AAAA`',
            );
        }

        const targetChannel = parseChannel(args, message.guild);
        if (!targetChannel) {
            return safeReply(message, '❌ Canal inválido! Mencione um canal de texto com #.');
        }

        // ── 2. Parsear intervalo ──────────────────────────────────────────────
        const rangeStr = args.slice(1).join(' ').trim();
        let rangeStart: Date;
        let rangeEnd:   Date;

        if (rangeStr.includes('->')) {
            const parsed = parseTimeRange(rangeStr);
            if (!parsed) {
                return safeReply(message,
                    '❌ Intervalo inválido! Exemplos:\n' +
                    '• `01/06/2024 -> 30/06/2024`\n' +
                    '• `09:00 01/06/2024 -> 18:00 30/06/2024`',
                );
            }
            rangeStart = parsed.start;
            rangeEnd   = parsed.end;
        } else {
            // Sem intervalo = histórico completo
            // Pega a primeira mensagem do canal para saber o início real
            rangeStart = new Date(0); // epoch — worker vai parar quando channel.messages retornar 0
            rangeEnd   = new Date();
        }

        // ── 3. Construir fila de dias ─────────────────────────────────────────
        // Para histórico completo, pega a data da msg mais antiga do canal
        let effectiveStart = rangeStart;
        if (rangeStart.getTime() === 0) {
            const statusFetch = await safeReply(message, '⏳ Identificando início do histórico...');
            try {
                const oldest = await targetChannel.messages.fetch({ limit: 1, after: '0' });
                if (oldest.size > 0) {
                    effectiveStart = new Date(oldest.first()!.createdTimestamp);
                    effectiveStart.setHours(0, 0, 0, 0);
                } else {
                    return safeEdit(statusFetch, '❌ O canal está vazio!');
                }
            } catch {
                return safeEdit(statusFetch, '❌ Sem permissão para ler mensagens neste canal.');
            }
            await statusFetch.delete().catch(() => {});
        }

        const rawDayQueue = buildDayQueue(effectiveStart, rangeEnd);
        const totalRawDays = rawDayQueue.length;

        // ── 4. Pre-scan: filtrar dias com mensagens ───────────────────────────
        // Antes de exportar, verifica rapidamente (1 fetch por dia) quais dias
        // têm mensagens. Dias vazios são descartados antes de qualquer trabalho.
        const scanStatus = await safeReply(message,
            `🔍 Verificando ${totalRawDays} dia(s) de histórico...`,
        );

        let dayQueue:  typeof rawDayQueue;
        let totalDays: number;
        let skippedByScanner: number;

        try {
            let lastScanUpdate = Date.now();
            const { activeDays, skippedDays } = await scanActiveDays(
                rawDayQueue,
                targetChannel,
                async (scanned, total) => {
                    // Atualiza o status a cada 5s durante o scan
                    if (Date.now() - lastScanUpdate > 5000) {
                        lastScanUpdate = Date.now();
                        await safeEdit(scanStatus,
                            `🔍 Verificando dias... **${scanned}/${total}** analisados`,
                        );
                    }
                },
            );
            dayQueue         = activeDays;
            totalDays        = activeDays.length;
            skippedByScanner = skippedDays;
        } catch (err) {
            await safeEdit(scanStatus, '❌ Erro ao verificar os dias. Tente novamente.');
            console.error('[exportchat] Erro no scan:', err);
            return;
        }

        if (totalDays === 0) {
            return safeEdit(scanStatus, '❌ Nenhuma mensagem encontrada no período especificado.');
        }

        await safeEdit(scanStatus,
            `✅ Scan concluído: **${totalDays}** dia(s) com mensagens` +
            (skippedByScanner > 0 ? ` · ${skippedByScanner} dia(s) vazio(s) ignorados` : ''),
        );

        // ── 5. Confirmação ────────────────────────────────────────────────────
        const estimatedFiles = Math.max(1, Math.ceil(totalDays * 0.5));

        if (totalDays > 3) {
            const commandCh = message.channel as TextChannel;
            const confirmed = await askConfirmation(commandCh, message.author.id, estimatedFiles);
            if (!confirmed) return;
        }

        // ── 6. Status inicial ─────────────────────────────────────────────────
        const statusMsg = await safeReply(message,
            `⏳ Iniciando export de <#${targetChannel.id}> (${totalDays} dia(s) com mensagens)...\n` +
            `-# Use \`rp!export end\` para cancelar`,
        );

        // ── 7. Criar sessão no disco ──────────────────────────────────────────
        const sessionPath = createSessionDir(message.author.id);

        // ── 8. Setup de cancelamento ──────────────────────────────────────────
        const exportKey = message.author.id;
        activeExports.set(exportKey, false);

        const cancelCollector = (message.channel as TextChannel).createMessageCollector({
            filter: (m: Message) =>
                m.author.id === message.author.id &&
                m.content.trim().toLowerCase() === 'rp!export end',
            time: 6 * 60 * 60 * 1000, // 6 horas máximo
        });
        cancelCollector.on('collect', () => {
            activeExports.set(exportKey, true);
            console.log(`[exportchat] Cancelamento solicitado por ${message.author.tag}`);
        });

        const isCancelled = () => activeExports.get(exportKey) === true;

        // ── 9. Progress tracker ───────────────────────────────────────────────
        const progress = new ProgressTracker(statusMsg, targetChannel.id, totalDays);
        progress.start();

        // ── 9. Caches compartilhados entre workers ────────────────────────────
        const colorCache   = new Map<string, string>();
        const nameCache    = new Map<string, string>();
        const pendingFetch = new Set<string>(); // evita fetch duplicado do mesmo userId

        const makeRenderer = () => new SegmentRenderer(colorCache, nameCache, message.guild!, pendingFetch);

        // ── 10. Lançar 3 workers em paralelo ──────────────────────────────────
        // A fila é um array compartilhado — .shift() é atômico em JS single-thread.
        // Cada worker pega o próximo dia disponível ao terminar o atual.
        const sharedQueue = [...dayQueue]; // cópia da fila para os workers consumirem

        const NUM_WORKERS = 3;
        const workerPromises = Array.from({ length: NUM_WORKERS }, (_, i) =>
            runWorker(i + 1, sharedQueue, sessionPath, targetChannel, makeRenderer(), progress, isCancelled),
        );

        let workerResults;
        try {
            workerResults = await Promise.all(workerPromises);
        } catch (err) {
            await progress.stop();
            cancelCollector.stop();
            activeExports.delete(exportKey);
            deleteSession(sessionPath);
            console.error('[exportchat] Erro fatal nos workers:', err);
            return safeEdit(statusMsg, '❌ Erro fatal durante a exportação. Tente novamente.');
        }

        // Cancelamento durante os workers
        if (isCancelled()) {
            await progress.stop();
            cancelCollector.stop();
            activeExports.delete(exportKey);
            deleteSession(sessionPath);
            const totalRead = workerResults.reduce((s, r) => s + r.totalMessages, 0);
            return safeEdit(statusMsg, `🛑 Export cancelado. (${totalRead.toLocaleString('pt-BR')} mensagens lidas até o cancelamento)`);
        }

        await progress.stop(`⚙️ Processando e dividindo arquivos...`);

        // ── 11. Merge dos segmentos → arquivos de output ──────────────────────
        const totalRead   = workerResults.reduce((s, r) => s + r.totalMessages, 0);
        const skippedDays = workerResults.reduce((s, r) => s + r.skippedDays, 0);
        const errors      = workerResults.flatMap(r => r.errors);

        const dateStr  = new Date().toLocaleDateString('pt-BR');
        const subtitle = `${totalRead.toLocaleString('pt-BR')} mensagens · exportado em ${dateStr}`;

        let mergeResult;
        try {
            mergeResult = await mergeSegments(sessionPath, targetChannel.name, subtitle);
        } catch (err) {
            cancelCollector.stop();
            activeExports.delete(exportKey);
            deleteSession(sessionPath);
            console.error('[exportchat] Erro no merge:', err);
            return safeEdit(statusMsg, '❌ Erro ao montar os arquivos de saída.');
        }

        const { outputFiles, totalParts } = mergeResult;

        // ── 12. Abrir DM e enviar ─────────────────────────────────────────────
        let dmChannel;
        try {
            dmChannel = await message.author.createDM();
        } catch {
            cancelCollector.stop();
            activeExports.delete(exportKey);
            deleteSession(sessionPath);
            return safeEdit(statusMsg, '❌ Não consegui abrir seu DM. Verifique se permite mensagens diretas.');
        }

        await safeEdit(statusMsg,
            `📤 Enviando **${totalParts}** arquivo(s) no seu DM...\n` +
            `-# Use \`rp!export end\` para cancelar`,
        );

        for (let i = 0; i < outputFiles.length; i++) {
            if (isCancelled()) break;

            const part       = i + 1;
            const filePath   = outputFiles[i];
            const fileName   = `${targetChannel.name}_parte${part}de${totalParts}.html`;
            const attachment = new AttachmentBuilder(filePath, { name: fileName });

            await dmChannel.send({
                content: `📦 **Parte ${part}/${totalParts}** — <#${targetChannel.id}>`,
                files:   [attachment],
            });
        }

        // ── 13. Finalizar ─────────────────────────────────────────────────────
        cancelCollector.stop();
        activeExports.delete(exportKey);
        deleteSession(sessionPath); // limpa o disco

        const errWarn = errors.length
            ? `\n⚠️ ${errors.length} dia(s) com erro foram ignorados.`
            : '';

        if (isCancelled()) {
            return safeEdit(statusMsg, `🛑 Envio interrompido. Verifique seu DM pelos arquivos já enviados.`);
        }

        const skippedNote = skippedDays > 0
            ? `\n-# ${skippedDays} dia(s) sem mensagens ignorados`
            : '';

        return safeEdit(statusMsg,
            `✅ **Export concluído!**\n` +
            `📨 ${totalRead.toLocaleString('pt-BR')} mensagens · ${totalParts} arquivo(s) enviados no seu DM.` +
            errWarn + skippedNote,
        );
    },
};