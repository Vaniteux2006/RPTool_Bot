// RPTool/supercommands/logs/utils/HtmlTranscript.ts
// ─── Gerador de Transcript HTML ───────────────────────────────────────────────
// Extraído do supercommands/exportchat/index.ts para ser reutilizável.
// Usado por:
//   - supercommands/exportchat/index.ts  → export de canal por demanda
//   - supercommands/logs/events/Messagelogs.ts → bulk delete automático
//
// ATENÇÃO: se alterar o CSS/HTML aqui, afeta os dois usos.
// Manter em sync com o exportchat se ele for atualizado manualmente.

import { Message, AttachmentBuilder } from 'discord.js';

// ─── Limite de tamanho por arquivo ───────────────────────────────────────────
// Discord aceita até 8 MB por mensagem — usamos 7,5 MB com margem de segurança.
// Com HTML comprimido, isso representa facilmente 50k–100k mensagens por arquivo.
const MAX_FILE_BYTES = 7.5 * 1024 * 1024;

// ─── Escape HTML ──────────────────────────────────────────────────────────────
export function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Markdown inline ──────────────────────────────────────────────────────────
function inlineMarkdown(s: string): string {
    const codes: string[] = [];
    const safe2 = s.split('`');
    if (safe2.length > 1) {
        let result = '';
        for (let j = 0; j < safe2.length; j++) {
            if (j % 2 === 0) { result += safe2[j]; }
            else {
                const idx = codes.length;
                codes.push('<code class="md-code">' + safe2[j] + '</code>');
                result += '\x02C' + idx + '\x03';
            }
        }
        s = result;
    }
    s = s.replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*(.+?)\*\*/gs,     '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/gs,         '<em>$1</em>');
    s = s.replace(/___(.+?)___/gs,       '<u><strong><em>$1</em></strong></u>');
    s = s.replace(/__\*\*(.+?)\*\*__/gs, '<u><strong>$1</strong></u>');
    s = s.replace(/__\*(.+?)\*__/gs,     '<u><em>$1</em></u>');
    s = s.replace(/__(.+?)__/gs,         '<u>$1</u>');
    s = s.replace(/~~(.+?)~~/gs,         '<s>$1</s>');
    s = s.replace(/(?<!\w)_(?!_)(.+?)(?<!_)_(?!\w)/gs, '<em>$1</em>');
    return s.replace(/\x02C(\d+)\x03/g, (_, i) => codes[+i]);
}

// ─── Markdown de bloco ────────────────────────────────────────────────────────
function renderMarkdown(s: string): string {
    const blocks: string[] = [];
    const parts = s.split('```');
    if (parts.length > 1) {
        let result = '';
        for (let j = 0; j < parts.length; j++) {
            if (j % 2 === 0) { result += parts[j]; }
            else {
                const idx = blocks.length;
                const code = parts[j].replace(/^[^\n]*\n/, '').trimEnd();
                blocks.push('<pre class="md-pre"><code>' + code + '</code></pre>');
                result += '\x02B' + idx + '\x03';
            }
        }
        s = result;
    }
    const lines = s.split('\n');
    const out = lines.map(line => {
        if (/^&gt;\s/.test(line))  return '<div class="md-q">'  + inlineMarkdown(line.replace(/^&gt;\s/, ''))  + '</div>';
        if (/^### /.test(line))    return '<div class="md-h3">' + inlineMarkdown(line.slice(4))  + '</div>';
        if (/^## /.test(line))     return '<div class="md-h2">' + inlineMarkdown(line.slice(3))  + '</div>';
        if (/^# /.test(line))      return '<div class="md-h1">' + inlineMarkdown(line.slice(2))  + '</div>';
        if (/^-# /.test(line))     return '<div class="md-sm">' + inlineMarkdown(line.slice(3))  + '</div>';
        return inlineMarkdown(line);
    });
    return out.join('\n').replace(/\x02B(\d+)\x03/g, (_, i) => blocks[+i]);
}

// ─── Render de conteúdo de mensagem ──────────────────────────────────────────
export function renderContent(raw: string, nameCache: Map<string, string>): string {
    let safe = esc(raw);
    safe = safe.replace(/&lt;@!?(\d+)&gt;/g, (_, id) => {
        const name = nameCache.get(id) ?? `@${id}`;
        return `<span class="mention">@${esc(name)}</span>`;
    });
    safe = safe.replace(/&lt;(a?):([^:]+):(\d+)&gt;/g, (_, anim, name, id) => {
        const ext = anim === 'a' ? 'gif' : 'png';
        const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
        return `<img class="emoji" src="${url}" alt=":${esc(name)}:" title=":${esc(name)}:" loading="lazy"/>`;
    });
    return renderMarkdown(safe);
}

// ─── CSS compartilhado ────────────────────────────────────────────────────────
const SHARED_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#313338;color:#dbdee1;font-family:"gg sans","Noto Sans",Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5}
.hdr{background:#1e1f22;padding:14px 24px;border-bottom:2px solid #111214;position:sticky;top:0;z-index:10}
.hdr h1{font-size:17px;color:#f2f3f5}
.hdr p{font-size:12px;color:#949ba4;margin-top:3px}
.msgs{max-width:940px;margin:0 auto;padding:16px 24px 32px}
.date-div{display:flex;align-items:center;gap:8px;color:#949ba4;font-size:12px;font-weight:600;margin:20px 0 6px}
.date-div::before,.date-div::after{content:'';flex:1;height:1px;background:#3f4147}
.grp{display:flex;gap:16px;padding:2px 0;margin-top:14px}
.grp.cont{margin-top:1px}
.av{width:40px;height:40px;border-radius:50%;flex-shrink:0;object-fit:cover;background:#5865f2}
.sp{width:40px;flex-shrink:0}
.col{flex:1;min-width:0}
.mhdr{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
.un{font-weight:600;font-size:15px}
.ts{font-size:11px;color:#949ba4}
.txt{color:#dbdee1;word-break:break-word;white-space:pre-wrap}
.att{margin-top:6px}
.att img{max-width:420px;max-height:320px;border-radius:4px;display:block;background:#2b2d31}
.mention{color:#7289da;background:rgba(114,137,218,.15);border-radius:3px;padding:0 2px;font-weight:500;cursor:default}
.emoji{width:1.375em;height:1.375em;vertical-align:middle;object-fit:contain;margin:0 1px}
.md-h1{font-size:1.5em;font-weight:700;color:#f2f3f5;border-bottom:1px solid #3f4147;padding-bottom:4px;margin:6px 0 2px}
.md-h2{font-size:1.25em;font-weight:700;color:#f2f3f5;border-bottom:1px solid #3f4147;padding-bottom:2px;margin:4px 0 2px}
.md-h3{font-size:1.05em;font-weight:700;color:#f2f3f5;margin:3px 0 1px}
.md-sm{font-size:.75em;color:#949ba4}
.md-q{border-left:3px solid #4e5058;padding:2px 0 2px 10px;color:#dbdee1;margin:2px 0}
.md-code{background:#2b2d31;color:#c9d1d9;font-family:Consolas,"Courier New",monospace;font-size:.875em;padding:0 4px;border-radius:3px}
.md-pre{background:#2b2d31;border-radius:4px;padding:10px 14px;margin:4px 0;overflow-x:auto}
.md-pre code{font-family:Consolas,"Courier New",monospace;font-size:.875em;color:#c9d1d9;white-space:pre}
.emb{display:flex;margin-top:6px;border-radius:4px;overflow:hidden;background:#2b2d31;max-width:520px}
.emb-bar{width:4px;flex-shrink:0;border-radius:4px 0 0 4px}
.emb-body{padding:10px 14px 10px 12px;flex:1;min-width:0}
.emb-author{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.emb-author img{width:18px;height:18px;border-radius:50%}
.emb-author span{font-size:12px;font-weight:600;color:#f2f3f5}
.emb-title{font-weight:700;color:#f2f3f5;margin-bottom:4px;font-size:15px}
.emb-title a{color:#00aff4;text-decoration:none}
.emb-desc{color:#dbdee1;font-size:14px;white-space:pre-wrap;word-break:break-word;margin-bottom:6px}
.emb-fields{display:grid;gap:6px;margin-bottom:6px}
.emb-field{min-width:0}
.emb-field-name{font-size:13px;font-weight:700;color:#f2f3f5;margin-bottom:1px}
.emb-field-val{font-size:13px;color:#dbdee1;white-space:pre-wrap;word-break:break-word}
.emb-img{margin-top:8px}
.emb-img img{max-width:100%;max-height:280px;border-radius:4px;display:block}
.emb-thumb{width:80px;height:80px;flex-shrink:0;object-fit:cover;border-radius:4px;margin:10px 10px 10px 0}
.emb-wrap{display:flex}
.emb-footer{font-size:12px;color:#949ba4;margin-top:6px;display:flex;align-items:center;gap:5px}
.emb-footer img{width:16px;height:16px;border-radius:50%}
.reactions{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.rxn{display:inline-flex;align-items:center;gap:4px;background:#2b2d31;border:1px solid #3f4147;border-radius:8px;padding:2px 7px;font-size:13px;cursor:default;position:relative}
.rxn:hover .rxn-tip{display:block}
.rxn-tip{display:none;position:absolute;bottom:calc(100% + 4px);left:0;background:#111214;color:#dbdee1;font-size:12px;border-radius:4px;padding:5px 8px;white-space:nowrap;z-index:20;box-shadow:0 2px 8px rgba(0,0,0,.5);max-width:300px;word-break:break-word}
.rxn-emoji{width:1.1em;height:1.1em;vertical-align:middle}
.emoji-jumbo{width:2.5em;height:2.5em;vertical-align:middle;object-fit:contain;margin:1px 2px}
/* ── Específico do log de bulk delete ── */
.log-banner{background:#ed4245;color:#fff;font-size:13px;font-weight:600;padding:8px 24px;text-align:center;letter-spacing:.3px}
`;

// ─── Header HTML ──────────────────────────────────────────────────────────────
export function htmlHeader(title: string, subtitle: string, part: number, total: number): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Parte ${part}/${total}</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="hdr">
  <h1>${esc(title)} — Parte ${part}/${total}</h1>
  <p>${esc(subtitle)}</p>
</div>
<div class="msgs">
`;
}

export const HTML_FOOTER = `</div></body></html>`;

// ─── Slug ─────────────────────────────────────────────────────────────────────
function slugify(s: string): string {
    return s
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'user';
}

// ─── Interface de chunk ───────────────────────────────────────────────────────
export interface HtmlChunk {
    messages: Message[];
    body: string;
}

// ─── buildChunks ──────────────────────────────────────────────────────────────
// Divide a lista de mensagens em chunks que respeitam MAX_FILE_BYTES.
// colorCache: userId → cor hex do cargo mais alto
// nameCache:  userId → displayName (para resolver menções)
export function buildChunks(
    messages: Message[],
    colorCache: Map<string, string>,
    nameCache: Map<string, string>,
): HtmlChunk[] {
    const chunks: HtmlChunk[] = [];
    let body          = '';
    let chunkMsgs: Message[] = [];
    let lastAuthorKey = '';
    let lastDateLabel = '';
    const slugCount   = new Map<string, number>();

    const flush = () => {
        if (chunkMsgs.length === 0) return;
        chunks.push({ messages: [...chunkMsgs], body });
        body          = '';
        chunkMsgs     = [];
        lastAuthorKey = '';
        lastDateLabel = '';
    };

    for (const msg of messages) {
        const ts        = new Date(msg.createdTimestamp);
        const dateLabel = ts.toLocaleDateString('pt-BR');
        const timeLabel = ts.toLocaleDateString('pt-BR') + ' - ' +
                          ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let piece = '';

        if (dateLabel !== lastDateLabel) {
            piece += `<div class="date-div"><span>${esc(dateLabel)}</span></div>`;
            lastDateLabel = dateLabel;
            lastAuthorKey = '';
        }

        const displayName = msg.member?.displayName ?? msg.author.username;
        const authorKey   = msg.author.id + '|' + displayName;
        const newGroup    = authorKey !== lastAuthorKey;
        lastAuthorKey     = authorKey;
        const color       = colorCache.get(msg.author.id) ?? '#ffffff';

        const baseSlug = slugify(displayName);
        const slugN    = slugCount.get(baseSlug) ?? 0;
        const divId    = newGroup ? (() => {
            const n = slugN + 1;
            slugCount.set(baseSlug, n);
            return baseSlug + (n > 1 ? '-' + n : '');
        })() : '';

        if (newGroup) {
            const av = msg.author.displayAvatarURL({ size: 64, extension: 'png' })
                       ?? 'https://cdn.discordapp.com/embed/avatars/0.png';
            piece += `<div class="grp" id="${divId}" data-user="${esc(displayName)}">` +
                     `<img class="av" src="${av}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"/>` +
                     `<div class="col">` +
                     `<div class="mhdr"><span class="un" style="color:${color}">${esc(displayName)}</span>` +
                     `<span class="ts">${timeLabel}</span></div>`;
        } else {
            piece += `<div class="grp cont"><div class="sp"></div><div class="col">`;
        }

        // Conteúdo textual
        if (msg.content) {
            const rendered    = renderContent(msg.content, nameCache);
            const strippedRaw = msg.content.trim();
            const onlyEmojis  = /^(\s|<a?:[^:]+:\d+>|\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u.test(strippedRaw)
                                && strippedRaw.length > 0;
            piece += onlyEmojis
                ? `<div class="txt">` + rendered.replace(/class="emoji"/g, 'class="emoji-jumbo"') + `</div>`
                : `<div class="txt">${rendered}</div>`;
        }

        // Anexos de imagem
        for (const att of msg.attachments.values()) {
            if (att.contentType?.startsWith('image/')) {
                piece += `<div class="att"><img src="${att.url}" loading="lazy"/></div>`;
            }
        }

        // Embeds
        for (const embed of msg.embeds) {
            const barColor = embed.color != null
                ? '#' + embed.color.toString(16).padStart(6, '0')
                : '#4f545c';
            let ep = `<div class="emb"><div class="emb-bar" style="background:${barColor}"></div>`;
            const hasThumbnail = !!embed.thumbnail?.url;
            ep += `<div class="emb-body">`;
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
            if (embed.fields.length > 0) {
                const allInline  = embed.fields.every(f => f.inline);
                const gridStyle  = allInline ? 'grid-template-columns:repeat(3,1fr)' : 'grid-template-columns:1fr';
                ep += `<div class="emb-fields" style="${gridStyle}">`;
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
                ep += `<img class="emb-thumb" src="${esc(embed.thumbnail!.url)}" loading="lazy"/>`;
                ep += `</div>`;
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
            piece += ep;
        }

        // Reações
        if (msg.reactions.cache.size > 0) {
            piece += `<div class="reactions">`;
            for (const reaction of msg.reactions.cache.values()) {
                const emojiStr = reaction.emoji.id
                    ? `<img class="rxn-emoji" src="https://cdn.discordapp.com/emojis/${reaction.emoji.id}.${reaction.emoji.animated ? 'gif' : 'png'}" alt="${esc(reaction.emoji.name ?? '')}"/>`
                    : esc(reaction.emoji.name ?? '?');
                const reactors = [...reaction.users.cache.values()]
                    .map(u => nameCache.get(u.id) ?? u.username).join(', ');
                piece += `<div class="rxn" title="${esc(reactors)}">` +
                         `${emojiStr}<span>${reaction.count}</span>` +
                         `<div class="rxn-tip">${esc(reactors || 'Passe o mouse para ver')}</div>` +
                         `</div>`;
            }
            piece += `</div>`;
        }

        piece += `</div></div>`;

        const estimatedSize = Buffer.byteLength(body + piece, 'utf8') + 3200;
        if (estimatedSize >= MAX_FILE_BYTES && chunkMsgs.length > 0) flush();

        body += piece;
        chunkMsgs.push(msg);
    }

    flush();
    return chunks;
}

// ─── buildAttachments ─────────────────────────────────────────────────────────
// Monta a lista de AttachmentBuilder prontos para enviar via Discord.
// title:    título do arquivo (ex: "purge-#geral-2024-06-01")
// subtitle: linha de info (ex: "27 mensagens deletadas")
// banner:   HTML opcional inserido antes do primeiro grupo de mensagens
export function buildAttachments(
    messages: Message[],
    colorCache: Map<string, string>,
    nameCache:  Map<string, string>,
    title:      string,
    subtitle:   string,
    banner?:    string,
): AttachmentBuilder[] {
    if (messages.length === 0) return [];

    const chunks = buildChunks(messages, colorCache, nameCache);
    const total  = chunks.length;

    return chunks.map((chunk, i) => {
        const part   = i + 1;
        const header = htmlHeader(title, subtitle, part, total);

        // Inserir banner (faixa de aviso) antes das mensagens — só na parte 1
        const bannerHtml = (part === 1 && banner)
            ? `<div class="log-banner">${esc(banner)}</div>`
            : '';

        const html     = header + bannerHtml + chunk.body + HTML_FOOTER;
        const safeName = title.replace(/[^\w\-]/g, '_').slice(0, 60);
        const fileName = `${safeName}_parte${part}de${total}.html`;

        return new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: fileName });
    });
}
