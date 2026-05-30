// RPTool/supercommands/logs/utils/LogMinister.ts
// ─── Ministro de Logs ─────────────────────────────────────────────────────────
// Centraliza: checar se logs está ativo, buscar o canal, enviar embeds e arquivos.

import { Guild, EmbedBuilder, TextChannel, AttachmentBuilder } from 'discord.js';
import { LogModel } from '../../../tools/models/LogConfig';
import type { LogCategory } from '../index';

export class LogMinister {
    private constructor(
        private readonly channel: TextChannel,
        private readonly categories: Record<string, boolean>,
    ) {}

    /** Retorna um LogMinister pronto para envio, ou null se logs não está ativo. */
    static async for(guild: Guild): Promise<LogMinister | null> {
        try {
            const config = await LogModel.findOne({ guildId: guild.id }).lean();
            if (!config || !config.enabled || !config.channelId) return null;

            const channel = guild.channels.cache.get(config.channelId) as TextChannel | undefined;
            if (!channel?.isTextBased()) return null;

            return new LogMinister(channel, config.categories ?? {});
        } catch {
            return null;
        }
    }

    /** Verifica se uma categoria está habilitada (padrão: sim para normais, não para opt-in). */
    allows(category: LogCategory): boolean {
        return this.categories[category] !== false;
    }

    /** Envia um embed no canal de log. */
    async send(embed: EmbedBuilder): Promise<void> {
        await this.channel.send({ embeds: [embed] }).catch(e =>
            console.error(`❌ [LogMinister] Falha ao enviar log em #${this.channel.name}:`, e),
        );
    }

    /** Envia um embed acompanhado de um ou mais arquivos (ex: HTML de bulk delete). */
    async sendWithFiles(embed: EmbedBuilder, files: AttachmentBuilder[]): Promise<void> {
        await this.channel.send({ embeds: [embed], files }).catch(e =>
            console.error(`❌ [LogMinister] Falha ao enviar embed+arquivo em #${this.channel.name}:`, e),
        );
    }

    /** Envia apenas um arquivo (sem embed), usado quando há múltiplos chunks de HTML. */
    async sendFile(file: AttachmentBuilder): Promise<void> {
        await this.channel.send({ files: [file] }).catch(e =>
            console.error(`❌ [LogMinister] Falha ao enviar arquivo em #${this.channel.name}:`, e),
        );
    }

    /** Envia múltiplos embeds de uma vez. */
    async sendMany(embeds: EmbedBuilder[]): Promise<void> {
        for (let i = 0; i < embeds.length; i += 10) {
            await this.channel.send({ embeds: embeds.slice(i, i + 10) }).catch(() => {});
        }
    }

    /** Envia uma mensagem de texto puro. */
    async sendText(content: string): Promise<void> {
        await this.channel.send({ content }).catch(() => {});
    }
}

// ─── Paleta de cores ──────────────────────────────────────────────────────────
export const LogColor = {
    join:         0x57F287, // verde    — entrou, criou, adicionou
    leave:        0xED4245, // vermelho — saiu, deletou, baniu
    update:       0x5865F2, // blurple  — editou, atualizou
    warn:         0xFEE75C, // amarelo  — edição de mensagem, kick
    voice:        0x5865F2, // blurple  — eventos de voz
    bulkDelete:   0xFF6B6B, // salmão   — purge de mensagens
    ban:          0xED4245, // vermelho — ban
    unban:        0x57F287, // verde    — unban
    automod:      0xFEE75C, // amarelo  — automod
    integration:  0x7289DA, // azul     — bots/webhooks
} as const;

// ─── Bloco de IDs ─────────────────────────────────────────────────────────────
// Gera o code block no estilo das imagens de referência.
// ```ini\nChave = valor\n```
// No Discord, ini colore keys em azul e values em laranja.
export function idBlock(entries: Record<string, string>): string {
    const lines = Object.entries(entries)
        .map(([k, v]) => `${k} = ${v}`)
        .join('\n');
    return `\`\`\`ini\n${lines}\n\`\`\``;
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

/** Trunca para o limite de field do embed (1024 chars) com reticências. */
export function truncate(text: string, limit = 1020): string {
    if (text.length <= limit) return text;
    return text.slice(0, limit) + '…';
}

/** Formata data estilo "segunda-feira, 10 de julho de 2022 às 18:08". */
export function formatDate(date: Date | null | undefined): string {
    if (!date) return 'Desconhecido';
    return date.toLocaleString('pt-BR', {
        weekday: 'long',
        day:     '2-digit',
        month:   'long',
        year:    'numeric',
        hour:    '2-digit',
        minute:  '2-digit',
        timeZone: 'America/Sao_Paulo',
    });
}

/** Calcula dias desde uma data. */
export function daysAgo(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

/** Retorna a URL do avatar ou null. */
export function avatarOf(user: { displayAvatarURL: (o?: any) => string } | null | undefined): string | null {
    return user?.displayAvatarURL({ size: 64 }) ?? null;
}
