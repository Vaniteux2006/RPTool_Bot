import {
    Message, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ComponentType, ButtonInteraction, MessageFlags } from 'discord.js';
import axios from 'axios';

// ─── rp!img ───────────────────────────────────────────────────────────────────
// Pesquisa de imagens em duas fontes:
//   • Serper.dev (Google Imagens) — só se SERPER_API_KEY estiver no .env. É a
//     que acerta termos de nicho ("chaveamento copa do brasil 2026").
//   • Bing (scraping da página de busca) — gratuito, sem chave. Bom para termos
//     comuns, fraco em termos muito específicos. Usado quando não há chave, a
//     cota do Serper acabou ou ele não achou nada.
// (O DuckDuckGo passou a responder com desafio anti-bot e foi removido.)
// O proxy do Discord não busca imagens de qualquer host (hotlink protection),
// então baixamos a imagem no bot e anexamos via attachment://. Se o site
// bloquear o download, caímos para a thumbnail do Bing (sempre embeda).

const MAX_RESULTS = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // limite de upload sem Nitro/boost
const COLLECTOR_TIME = 120_000;

interface ImageResult {
    link: string;          // URL da imagem em si
    title: string;
    contextLink: string;   // página onde a imagem está
    thumbnailLink: string; // thumbnail servida pelo gstatic
    width: number;
    height: number;
}

const EXT_BY_MIME: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp'
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// ─── Serper.dev (Google Imagens) ─────────────────────────────────────────────
async function searchSerper(query: string, apiKey: string): Promise<ImageResult[]> {
    const { data } = await axios.post('https://google.serper.dev/images',
        { q: query, gl: 'br', hl: 'pt-br', num: MAX_RESULTS, safe: 'active' },
        { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }, timeout: 10_000 }
    );

    return (data.images || []).slice(0, MAX_RESULTS).map((item: any) => ({
        link: item.imageUrl,
        title: item.title || 'Sem título',
        contextLink: item.link || item.imageUrl,
        thumbnailLink: item.thumbnailUrl || '',
        width: item.imageWidth || 0,
        height: item.imageHeight || 0
    }));
}

// ─── Bing (scraping) ─────────────────────────────────────────────────────────
// Cada resultado da página tem um atributo m="{...}" com o JSON da imagem
// (murl = imagem, purl = página, turl = thumbnail do bing.net, t = título).
// Sem cookies de sessão o Bing devolve resultados aleatórios; e cada nível de
// SafeSearch acerta termos diferentes (moderate vai bem em termos comuns,
// strict às vezes acerta os de nicho). Por isso buscamos nos dois e ficamos
// com os resultados cujo título/página contém as palavras pesquisadas.
const decodeHtml = (s: string) => s
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const BING_HEADERS = {
    'User-Agent': BROWSER_UA,
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
};
const BING_COOKIE_TTL = 30 * 60_000;
let bingCookie = { value: '', at: 0 };

async function getBingCookie(): Promise<string> {
    if (bingCookie.value && Date.now() - bingCookie.at < BING_COOKIE_TTL) return bingCookie.value;
    const response = await axios.get('https://www.bing.com/', { headers: BING_HEADERS, timeout: 8_000 });
    const value = (response.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    bingCookie = { value, at: Date.now() };
    return value;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Quantas palavras da busca aparecem no título ou no link da página. */
function relevance(result: ImageResult, terms: string[]): number {
    let page = result.contextLink;
    try { page = decodeURIComponent(page); } catch { /* link com % solto */ }
    const haystack = normalize(`${result.title} ${page}`);
    return terms.filter(t => haystack.includes(t)).length;
}

async function fetchBing(query: string, adlt: 'moderate' | 'strict'): Promise<ImageResult[]> {
    const { data } = await axios.get('https://www.bing.com/images/search', {
        params: { q: query, form: 'HDRSC2', first: 1, adlt },
        headers: { ...BING_HEADERS, Cookie: await getBingCookie().catch(() => '') },
        timeout: 10_000
    });

    const results: ImageResult[] = [];
    for (const match of String(data).matchAll(/ m="([^"]+)"/g)) {
        let item: any;
        try { item = JSON.parse(decodeHtml(match[1])); } catch { continue; }
        if (!item?.murl) continue;
        results.push({
            link: item.murl,
            title: item.t || 'Sem título',
            contextLink: item.purl || item.murl,
            thumbnailLink: item.turl || '',
            width: 0,
            height: 0
        });
    }
    return results;
}

async function searchBing(query: string): Promise<ImageResult[]> {
    const terms = [...new Set(normalize(query).split(/\s+/).filter(t => t.length >= 3))];
    let best: ImageResult[] = [];
    let lastError: unknown = null;
    let answered = false;

    for (const adlt of ['moderate', 'strict'] as const) {
        let results: ImageResult[];
        try { results = await fetchBing(query, adlt); } catch (error) { lastError = error; continue; }
        answered = true;

        // Sem termos úteis (ex: "gt"), não dá pra julgar relevância
        const ranked = terms.length === 0 ? results : results
            .map(r => ({ r, score: relevance(r, terms) }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(x => x.r);

        if (ranked.length > best.length) best = ranked;
        if (best.length >= MAX_RESULTS) break;
    }
    // As duas buscas falharam na rede → erro de verdade, não "nenhuma imagem"
    if (!answered) throw lastError;
    return best.slice(0, MAX_RESULTS);
}

async function searchImages(query: string): Promise<ImageResult[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (apiKey) {
        try {
            const results = await searchSerper(query, apiKey);
            if (results.length > 0) return results;
        } catch (error: any) {
            // 401/403 = chave inválida ou cota esgotada; segue pro Bing
            console.warn('[IMG] Serper falhou, usando Bing:', error?.response?.status || error?.message);
        }
    }
    return searchBing(query);
}

// Baixa a imagem e devolve o anexo pronto; null se o host bloquear/for grande demais.
async function downloadImage(url: string, index: number): Promise<{ attachment: AttachmentBuilder, fileName: string } | null> {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 8_000,
            maxContentLength: MAX_IMAGE_BYTES,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RPTool-Bot' }
        });

        const mime = String(response.headers['content-type'] || '').split(';')[0].trim();
        const ext = EXT_BY_MIME[mime];
        if (!ext) return null;

        const fileName = `img_${index}.${ext}`;
        return { attachment: new AttachmentBuilder(Buffer.from(response.data), { name: fileName }), fileName };
    } catch {
        return null;
    }
}

function buildEmbed(query: string, results: ImageResult[], index: number, requester: string, fileName: string | null): EmbedBuilder {
    const result = results[index];
    const embed = new EmbedBuilder()
        .setColor(0x4285F4)
        .setTitle(result.title.slice(0, 256))
        .setURL(result.contextLink)
        .setDescription(`🔎 Pesquisa: **${query}**`)
        .setFooter({ text: `Resultado ${index + 1}/${results.length} • Pedido por ${requester}` });

    if (fileName) embed.setImage(`attachment://${fileName}`);
    else if (result.thumbnailLink) embed.setImage(result.thumbnailLink);

    if (result.width && result.height) {
        embed.addFields({ name: '📐 Dimensões', value: `${result.width}x${result.height}`, inline: true });
    }
    return embed;
}

function buildRow(index: number, total: number, disabledAll = false): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('img_prev').setEmoji('◀️').setStyle(ButtonStyle.Primary)
            .setDisabled(disabledAll || index === 0),
        new ButtonBuilder().setCustomId('img_next').setEmoji('▶️').setStyle(ButtonStyle.Primary)
            .setDisabled(disabledAll || index >= total - 1),
        new ButtonBuilder().setCustomId('img_close').setEmoji('🗑️').setStyle(ButtonStyle.Secondary)
            .setDisabled(disabledAll)
    );
}

export default {
    name: 'img',
    description: 'Pesquisa imagens na web. Ex: rp!img seleção brasileira',
    aliases: ['imagem', 'image', 'googleimg'],

    async execute(message: Message, args: string[]) {
        const query = args.join(' ').trim();
        if (!query) {
            return message.reply('🔎 O que você quer procurar? Ex: `rp!img seleção brasileira`');
        }

        if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
            await message.channel.sendTyping();
        }

        let results: ImageResult[];
        try {
            results = await searchImages(query);
        } catch (error: any) {
            console.error('[IMG] Falha na pesquisa:', error?.message || error);
            return message.reply('❌ Não consegui buscar imagens agora. Tente de novo em instantes.');
        }

        if (results.length === 0) {
            return message.reply(`🤷 Nenhuma imagem encontrada para **${query}**.`);
        }

        const requester = message.author.username;
        let index = 0;

        // Cache dos downloads já feitos para não rebaixar ao voltar de página.
        const downloadCache = new Map<number, { attachment: AttachmentBuilder, fileName: string } | null>();

        const getPagePayload = async (i: number) => {
            if (!downloadCache.has(i)) {
                downloadCache.set(i, await downloadImage(results[i].link, i));
            }
            const downloaded = downloadCache.get(i) || null;
            return {
                embeds: [buildEmbed(query, results, i, requester, downloaded?.fileName || null)],
                components: [buildRow(i, results.length)],
                files: downloaded ? [downloaded.attachment] : [],
                attachments: [] // limpa o anexo da página anterior
            };
        };

        const firstPage = await getPagePayload(0);
        const response = await message.reply(firstPage);

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: COLLECTOR_TIME
        });

        collector.on('collect', async (i: ButtonInteraction) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: '🔒 Só quem pesquisou pode navegar. Faça sua própria busca com `rp!img`!', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'img_close') {
                collector.stop('closed');
                return i.update({ content: '🗑️ Pesquisa encerrada.', embeds: [], components: [], files: [], attachments: [] });
            }

            index += i.customId === 'img_next' ? 1 : -1;
            index = Math.max(0, Math.min(index, results.length - 1));

            // O download pode passar dos 3s da interação, então defer antes.
            await i.deferUpdate();
            try {
                await response.edit(await getPagePayload(index));
            } catch (error) {
                console.error('[IMG] Falha ao trocar de página:', error);
            }
        });

        collector.on('end', async (_collected, reason) => {
            if (reason === 'closed') return;
            try {
                await response.edit({ components: [buildRow(index, results.length, true)] });
            } catch { /* mensagem pode ter sido apagada */ }
        });
    }
};
