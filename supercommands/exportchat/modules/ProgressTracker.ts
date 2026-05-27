// RPTool/supercommands/exportchat/modules/ProgressTracker.ts
// ─── Rastreador de progresso compartilhado entre workers ─────────────────────
// Atualiza a mensagem de status a cada 30s com contagem e intervalo de datas.

import { Message } from 'discord.js';

async function safeEdit(msg: Message, content: string): Promise<void> {
    try {
        await msg.edit(content);
    } catch {
        const ch = msg.channel;
        if (!('send' in ch) || typeof (ch as any).send !== 'function') return;
        await (ch as any).send(content).catch(() => {});
    }
}

export class ProgressTracker {
    private totalRead    = 0;
    private daysFinished = 0;
    private totalDays:   number;
    private oldestDate:  Date | null = null;
    private newestDate:  Date | null = null;
    private lastUpdate   = Date.now();
    private intervalId:  ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly statusMsg:   Message,
        private readonly channelId:   string,
        private readonly totalDaysIn: number,
    ) {
        this.totalDays = totalDaysIn;
    }

    // ── Chamado por cada worker ao processar uma mensagem ─────────────────────
    increment(msgDate: Date): void {
        this.totalRead++;
        if (!this.oldestDate || msgDate < this.oldestDate) this.oldestDate = msgDate;
        if (!this.newestDate || msgDate > this.newestDate) this.newestDate = msgDate;
    }

    // ── Chamado por cada worker ao terminar um dia ────────────────────────────
    finishDay(): void {
        this.daysFinished++;
    }

    // ── Inicia o loop de atualização de 30s ──────────────────────────────────
    start(): void {
        this.intervalId = setInterval(() => this.update(), 30_000);
    }

    // ── Para o loop e faz update final ───────────────────────────────────────
    async stop(finalMessage?: string): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (finalMessage) {
            await safeEdit(this.statusMsg, finalMessage);
        }
    }

    // ── Atualiza a mensagem de status ─────────────────────────────────────────
    private async update(): Promise<void> {
        const dateRange = this.oldestDate && this.newestDate
            ? ` *(${this.oldestDate.toLocaleDateString('pt-BR')} → ${this.newestDate.toLocaleDateString('pt-BR')})*`
            : '';

        const content =
            `⏳ Exportando <#${this.channelId}>...\n` +
            `📨 **${this.totalRead.toLocaleString('pt-BR')}** mensagens lidas${dateRange}\n` +
            `📅 **${this.daysFinished}/${this.totalDays}** dias concluídos\n` +
            `-# Use \`rp!export end\` para cancelar`;

        await safeEdit(this.statusMsg, content);
    }
}
