import {
    Message, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ComponentType, ButtonInteraction, MessageFlags } from 'discord.js';
import axios from 'axios';

// ─── rp!img ───────────────────────────────────────────────────────────────────
// Pesquisa de imagens via DuckDuckGo (resultados do Bing por baixo) — gratuito,
// sem chave de API e sem cota. Fluxo: pega o token "vqd" da página de busca,
// depois consulta o endpoint JSON i.js.
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

// O DuckDuckGo exige um token "vqd" atrelado à query, extraído do HTML da busca
async function getVqd(query: string): Promise<string | null> {
    const { data } = await axios.get('https://duckduckgo.com/', {
        params: { q: query, ia: 'images', iax: 'images' },
        headers: { 'User-Agent': BROWSER_UA },
        timeout: 8_000
    });
    const match = String(data).match(/vqd=["']?([\d-]+)["']?/);
    return match ? match[1] : null;
}

async function searchImages(query: string): Promise<ImageResult[]> {
    const vqd = await getVqd(query);
    if (!vqd) throw new Error('Não foi possível obter o token de busca (vqd) do DuckDuckGo.');

    // O endpoint devolve 403 sem o conjunto completo de headers de navegador
    const { data } = await axios.get('https://duckduckgo.com/i.js', {
        params: {
            l: 'br-pt',
            o: 'json',
            q: query,
            vqd,
            f: ',,,',
            p: '1' // SafeSearch ativo
        },
        headers: {
            'User-Agent': BROWSER_UA,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Referer': `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
        },
        timeout: 10_000
    });

    return (data.results || []).slice(0, MAX_RESULTS).map((item: any) => ({
        link: item.image,
        title: item.title || 'Sem título',
        contextLink: item.url || item.image,
        thumbnailLink: item.thumbnail || '',
        width: item.width || 0,
        height: item.height || 0
    }));
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
