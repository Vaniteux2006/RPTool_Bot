// RPTool/supercommands/exportchat/modules/SegmentRenderer.ts
// ─── Renderer HTML com estado por worker ─────────────────────────────────────
// Cada worker instancia um SegmentRenderer próprio.
// Renderiza mensagens uma a uma e escreve diretamente no arquivo de segmento
// do disco — sem acumular em memória.
// O arquivo de segmento contém APENAS o corpo HTML das mensagens (sem header/CSS).
// O header/CSS/footer são adicionados pelo merger no momento de montar o output.

import fs   from 'fs';
import path from 'path';
import { Message, Guild } from 'discord.js';
import { esc, renderContent } from '../../../tools/HtmlTranscript';

export class SegmentRenderer {
    private lastAuthorKey = '';
    private lastDateLabel = '';
    private slugCount     = new Map<string, number>();

    constructor(
        private readonly colorCache:  Map<string, string>,
        private readonly nameCache:   Map<string, string>,
        private readonly guild:       Guild,
        private readonly pendingFetch: Set<string>,
    ) {}

    // ── Garante que userId está nos caches (lazy, compartilhado entre workers) ─
    async ensureCached(userId: string): Promise<void> {
        if (this.colorCache.has(userId) || this.pendingFetch.has(userId)) return;
        this.pendingFetch.add(userId);
        try {
            const member = await this.guild.members.fetch(userId);
            const hex    = member.displayHexColor;
            this.colorCache.set(userId, hex === '#000000' ? '#ffffff' : hex);
            this.nameCache.set(userId, member.displayName);
        } catch {
            this.colorCache.set(userId, '#ffffff');
            // tag do usuário pode não estar disponível se saiu do servidor
            this.nameCache.set(userId, `User ${userId.slice(-4)}`);
        } finally {
            this.pendingFetch.delete(userId);
        }
    }

    // ── Renderiza uma mensagem e escreve no arquivo de segmento ───────────────
    async writeMessage(msg: Message, segFilePath: string): Promise<void> {
        await this.ensureCached(msg.author.id);

        const ts        = new Date(msg.createdTimestamp);
        const dateLabel = ts.toLocaleDateString('pt-BR');
        const timeLabel = ts.toLocaleDateString('pt-BR') + ' - ' +
                          ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let piece = '';

        // Divisor de data
        if (dateLabel !== this.lastDateLabel) {
            piece += `<div class="date-div"><span>${esc(dateLabel)}</span></div>`;
            this.lastDateLabel = dateLabel;
            this.lastAuthorKey = ''; // força novo grupo após mudança de dia
        }

        const displayName = this.nameCache.get(msg.author.id) ?? msg.author.username;
        const authorKey   = `${msg.author.id}|${displayName}`;
        const newGroup    = authorKey !== this.lastAuthorKey;
        this.lastAuthorKey = authorKey;

        const color = this.colorCache.get(msg.author.id) ?? '#ffffff';

        if (newGroup) {
            const slugBase = slugify(displayName);
            const slugN    = (this.slugCount.get(slugBase) ?? 0) + 1;
            this.slugCount.set(slugBase, slugN);
            const divId    = slugBase + (slugN > 1 ? `-${slugN}` : '');

            const av = msg.author.displayAvatarURL({ size: 64, extension: 'png' });
            piece +=
                `<div class="grp" id="${divId}" data-user="${esc(displayName)}">` +
                `<img class="av" src="${av}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"/>` +
                `<div class="col">` +
                `<div class="mhdr">` +
                `<span class="un" style="color:${color}">${esc(displayName)}</span>` +
                `<span class="ts">${timeLabel}</span>` +
                `</div>`;
        } else {
            piece += `<div class="grp cont"><div class="sp"></div><div class="col">`;
        }

        // Conteúdo textual
        if (msg.content) {
            const rendered   = renderContent(msg.content, this.nameCache);
            const onlyEmojis = /^(\s|<a?:[^:]+:\d+>|\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u.test(msg.content.trim())
                               && msg.content.trim().length > 0;
            piece += onlyEmojis
                ? `<div class="txt">${rendered.replace(/class="emoji"/g, 'class="emoji-jumbo"')}</div>`
                : `<div class="txt">${rendered}</div>`;
        }

        // Imagens anexadas
        for (const att of msg.attachments.values()) {
            if (att.contentType?.startsWith('image/')) {
                piece += `<div class="att"><img src="${att.url}" loading="lazy"/></div>`;
            }
        }

        // Embeds
        for (const embed of msg.embeds) {
            piece += renderEmbed(embed, this.nameCache);
        }

        // Reações
        if (msg.reactions.cache.size > 0) {
            piece += `<div class="reactions">`;
            for (const reaction of msg.reactions.cache.values()) {
                const emojiStr = reaction.emoji.id
                    ? `<img class="rxn-emoji" src="https://cdn.discordapp.com/emojis/${reaction.emoji.id}.${reaction.emoji.animated ? 'gif' : 'png'}" alt="${esc(reaction.emoji.name ?? '')}"/>`
                    : esc(reaction.emoji.name ?? '?');
                const reactors = [...reaction.users.cache.values()]
                    .map(u => this.nameCache.get(u.id) ?? u.username).join(', ');
                piece +=
                    `<div class="rxn" title="${esc(reactors)}">` +
                    `${emojiStr}<span>${reaction.count}</span>` +
                    `<div class="rxn-tip">${esc(reactors || 'Sem dados')}</div>` +
                    `</div>`;
            }
            piece += `</div>`;
        }

        piece += `</div></div>`;

        // Escreve diretamente no disco — sem acumular em memória
        fs.appendFileSync(segFilePath, piece, 'utf8');
    }
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

function slugify(s: string): string {
    return s
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'user';
}

function renderEmbed(embed: any, nameCache: Map<string, string>): string {
    const barColor = embed.color != null
        ? '#' + embed.color.toString(16).padStart(6, '0')
        : '#4f545c';

    let ep = `<div class="emb"><div class="emb-bar" style="background:${barColor}"></div><div class="emb-body">`;
    const hasThumbnail = !!embed.thumbnail?.url;
    if (hasThumbnail) ep += `<div class="emb-wrap">`;
    ep += `<div style="flex:1;min-width:0">`;

    if (embed.author) {
        ep += `<div class="emb-author">`;
        if (embed.author.iconURL) ep += `<img src="${esc(embed.author.iconURL)}" loading="lazy"/>`;
        const authorText = embed.author.url
            ? `<a href="${esc(embed.author.url)}" target="_blank">${esc(embed.author.name ?? '')}</a>`
            : esc(embed.author.name ?? '');
        ep += `<span>${authorText}</span></div>`;
    }
    if (embed.title) {
        const titleInner = embed.url
            ? `<a href="${esc(embed.url)}" target="_blank">${esc(embed.title)}</a>`
            : esc(embed.title);
        ep += `<div class="emb-title">${titleInner}</div>`;
    }
    if (embed.description) ep += `<div class="emb-desc">${renderContent(embed.description, nameCache)}</div>`;
    if (embed.fields?.length) {
        const allInline = embed.fields.every((f: any) => f.inline);
        ep += `<div class="emb-fields" style="${allInline ? 'grid-template-columns:repeat(3,1fr)' : 'grid-template-columns:1fr'}">`;
        for (const field of embed.fields) {
            ep += `<div class="emb-field">` +
                  `<div class="emb-field-name">${renderContent(field.name, nameCache)}</div>` +
                  `<div class="emb-field-val">${renderContent(field.value, nameCache)}</div>` +
                  `</div>`;
        }
        ep += `</div>`;
    }
    ep += `</div>`;
    if (hasThumbnail) {
        ep += `<img class="emb-thumb" src="${esc(embed.thumbnail!.url)}" loading="lazy"/></div>`;
    }
    if (embed.image?.url) ep += `<div class="emb-img"><img src="${esc(embed.image.url)}" loading="lazy"/></div>`;
    if (embed.footer) {
        ep += `<div class="emb-footer">`;
        if (embed.footer.iconURL) ep += `<img src="${esc(embed.footer.iconURL)}" loading="lazy"/>`;
        ep += `<span>${esc(embed.footer.text ?? '')}</span>`;
        if (embed.timestamp) {
            const ft = new Date(embed.timestamp);
            ep += `<span>• ${ft.toLocaleDateString('pt-BR')} ${ft.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>`;
        }
        ep += `</div>`;
    }
    ep += `</div></div>`;
    return ep;
}
