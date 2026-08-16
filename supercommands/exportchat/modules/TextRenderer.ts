// RPTool/supercommands/exportchat/modules/TextRenderer.ts
// ─── Renderer de texto puro (modo `readable`) ────────────────────────────────
//
// Mesma interface do SegmentRenderer (SegmentWriter), mas escreve .txt em vez de
// HTML. O alvo aqui é leitura por IA / humano: nada de tags, CSS ou base64 —
// só a conversa, uma mensagem por bloco:
//
//     ===== 01/06/2025 =====
//     Nick, 00:00 - Frase aqui :nomedoemoji: [*Imagem*] @Fulano @Cargo **Negrito**
//
// Regras do formato:
//   • markdown do Discord é PRESERVADO literal (**, *, __, ~~, ||, `) — é sinal
//     de ênfase que a IA entende, e reescrever perderia informação;
//   • o que é ilegível em texto vira marcador entre [* *]: imagem, anexo, embed;
//   • menções (<@id>, <@&id>, <#id>) e emojis custom (<:nome:id>) viram o nome.

import fs from 'fs';
import { Message, Guild } from 'discord.js';

// Acima deste tamanho, o buffer do dia é despejado no disco (append assíncrono)
const FLUSH_THRESHOLD_BYTES = 2 * 1024 * 1024;

// Descrição/campos de embed são cortados: um embed gigante afogaria a conversa.
const EMBED_MAX_CHARS = 600;
const QUOTE_MAX_CHARS = 80;

export class TextRenderer {
    private lastDateLabel = '';
    private buf      = '';
    private bufBytes = 0;

    constructor(
        private readonly nameCache:   Map<string, string>,
        private readonly guild:       Guild,
        private readonly pendingFetch: Set<string>,
        // IDs já resolvidos (equivalente ao colorCache do SegmentRenderer: evita
        // refazer members.fetch do mesmo usuário em cada worker).
        private readonly resolvedIds: Set<string>,
    ) {}

    async flush(segFilePath: string): Promise<void> {
        if (this.buf.length === 0) return;
        const chunk = this.buf;
        this.buf = ''; this.bufBytes = 0;
        await fs.promises.appendFile(segFilePath, chunk, 'utf8');
    }

    discard(): void {
        this.buf = ''; this.bufBytes = 0;
    }

    // ── Resolve o apelido do autor ────────────────────────────────────────────
    // Mesma lógica do SegmentRenderer: webhooks (Tupperbox) usam author.username
    // por mensagem — o mesmo webhookId serve várias personagens, então cachear
    // pelo ID congelaria o nome da primeira.
    private async ensureCached(msg: Message): Promise<void> {
        if (msg.webhookId) return;

        const userId = msg.author.id;
        if (this.resolvedIds.has(userId)) return;
        if (this.pendingFetch.has(userId)) return; // outro worker já está fetchando

        this.pendingFetch.add(userId);
        try {
            const member = await this.guild.members.fetch(userId);
            this.nameCache.set(userId, member.displayName);
        } catch {
            // Saiu do servidor ou sem permissão
            this.nameCache.set(userId, msg.author.username);
        } finally {
            this.resolvedIds.add(userId);
            this.pendingFetch.delete(userId);
        }
    }

    // ── Nome de um usuário mencionado ─────────────────────────────────────────
    // A mensagem carrega os objetos das próprias menções, então dá pra nomear
    // gente que nunca falou no canal (e portanto não está no nameCache).
    private mentionName(id: string, msg: Message): string {
        const cached = this.nameCache.get(id);
        if (cached) return cached;

        const member = msg.mentions.members?.get(id) ?? this.guild.members.cache.get(id);
        if (member) return member.displayName;

        const user = msg.mentions.users.get(id);
        if (user) return user.username;

        return id;
    }

    // ── Converte a sintaxe do Discord para texto legível ──────────────────────
    private toReadable(raw: string, msg: Message): string {
        return raw
            // <@123> e <@!123> → @Nome
            .replace(/<@!?(\d+)>/g, (_, id) => `@${this.mentionName(id, msg)}`)
            // <@&123> → @Cargo
            .replace(/<@&(\d+)>/g, (_, id) => {
                const role = msg.mentions.roles.get(id) ?? this.guild.roles.cache.get(id);
                return `@${role?.name ?? id}`;
            })
            // <#123> → #canal
            .replace(/<#(\d+)>/g, (_, id) => {
                const ch = this.guild.channels.cache.get(id);
                return `#${ch?.name ?? id}`;
            })
            // <:nome:123> e <a:nome:123> → :nome:
            .replace(/<(a?):([^:\s]+):(\d+)>/g, (_, _anim, name) => `:${name}:`)
            // <t:1700000000:R> → [16/08/2026 14:30]
            .replace(/<t:(\d+)(?::[tTdDfFR])?>/g, (_, unix) => {
                const d = new Date(Number(unix) * 1000);
                return `[${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}]`;
            });
    }

    // ── Marcadores de anexo ───────────────────────────────────────────────────
    private attachmentTag(att: { contentType: string | null; name: string | null }): string {
        const type = att.contentType ?? '';
        if (type.startsWith('image/')) return '[*Imagem*]';
        if (type.startsWith('video/')) return '[*Vídeo*]';
        if (type.startsWith('audio/')) return '[*Áudio*]';
        return `[*Arquivo: ${att.name ?? 'sem nome'}*]`;
    }

    // ── Embed achatado numa linha ─────────────────────────────────────────────
    private embedTag(embed: any, msg: Message): string {
        const parts: string[] = [];
        if (embed.author?.name) parts.push(embed.author.name);
        if (embed.title)        parts.push(embed.title);
        if (embed.description)  parts.push(this.toReadable(embed.description, msg));
        for (const f of embed.fields ?? []) {
            parts.push(`${f.name}: ${this.toReadable(f.value ?? '', msg)}`);
        }
        if (embed.footer?.text) parts.push(embed.footer.text);

        // Quebras de linha viram " / " para o embed caber numa linha só
        let text = parts.join(' — ').replace(/\s*\n\s*/g, ' / ').trim();
        if (!text) return '[*Embed*]';
        if (text.length > EMBED_MAX_CHARS) text = text.slice(0, EMBED_MAX_CHARS) + '…';
        return `[*Embed: ${text}*]`;
    }

    // ── Renderiza uma mensagem ────────────────────────────────────────────────
    async writeMessage(msg: Message, segFilePath: string): Promise<void> {
        await this.ensureCached(msg);

        const ts        = new Date(msg.createdTimestamp);
        const dateLabel = ts.toLocaleDateString('pt-BR');
        const timeLabel = ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let piece = '';

        // Divisor de data — a IA precisa saber quando o dia virou
        if (dateLabel !== this.lastDateLabel) {
            piece += `${this.lastDateLabel ? '\n' : ''}===== ${dateLabel} =====\n\n`;
            this.lastDateLabel = dateLabel;
        }

        const displayName = msg.webhookId
            ? msg.author.username
            : (this.nameCache.get(msg.author.id) ?? msg.author.username);

        // ── Corpo ─────────────────────────────────────────────────────────────
        // Tupperbox embute o reply no próprio conteúdo — desmonta antes de tudo.
        let content = msg.content ?? '';
        const marks: string[] = [];

        const tupper = parseTupperReply(content);
        if (tupper) {
            marks.push(replyTag(tupper.user, tupper.quotedContent));
            content = tupper.actualContent;
        } else if (msg.reference?.messageId) {
            const replied = msg.mentions.repliedUser;
            const name    = replied
                ? (this.nameCache.get(replied.id) ?? replied.username)
                : 'alguém';
            marks.push(replyTag(name, null));
        }

        const body = content ? this.toReadable(content, msg) : '';

        // ── Marcadores do que não é texto ─────────────────────────────────────
        const tags: string[] = [];
        for (const att of msg.attachments.values()) tags.push(this.attachmentTag(att));
        for (const st  of msg.stickers.values())    tags.push(`[*Figurinha: ${st.name}*]`);
        for (const emb of msg.embeds)               tags.push(this.embedTag(emb, msg));

        // Mensagem de sistema (entrou no servidor, fixou mensagem...) não tem
        // nada legível — fica de fora do arquivo em vez de virar linha vazia.
        if (!body && tags.length === 0 && marks.length === 0) return;

        const line = [...marks, body, ...tags].filter(Boolean).join(' ');
        piece += `${displayName}, ${timeLabel} - ${line}\n`;

        this.buf      += piece;
        this.bufBytes += Buffer.byteLength(piece, 'utf8');
        if (this.bufBytes >= FLUSH_THRESHOLD_BYTES) await this.flush(segFilePath);
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function replyTag(username: string, quoted: string | null): string {
    const trecho = quoted
        ? `: "${quoted.replace(/\s*\n\s*/g, ' ').slice(0, QUOTE_MAX_CHARS)}"`
        : '';
    return `[*Resposta a ${username}${trecho}*]`;
}

/**
 * Detecta o formato de reply do Tupperbox no conteúdo da mensagem.
 * Formato: "[Reply to](<URL>): @Username\n\n<citação>\n\n<resposta>"
 */
function parseTupperReply(content: string): {
    user:          string;
    quotedContent: string;
    actualContent: string;
} | null {
    const firstNL   = content.indexOf('\n');
    const firstLine = firstNL === -1 ? content : content.slice(0, firstNL);
    const m = firstLine.match(/^\[Reply to\]\(<[^>]+>\):\s*@?(.+)$/);
    if (!m) return null;

    const rest  = (firstNL === -1 ? '' : content.slice(firstNL + 1)).replace(/^\n/, '');
    const split = rest.indexOf('\n\n');
    return {
        user:          m[1].trim(),
        quotedContent: split === -1 ? '' : rest.slice(0, split).trim(),
        actualContent: split === -1 ? rest.trim() : rest.slice(split + 2).trim(),
    };
}
