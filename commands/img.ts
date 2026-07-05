import {
    Message, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ComponentType, ButtonInteraction
} from 'discord.js';
import axios from 'axios';

// ─── rp!img ───────────────────────────────────────────────────────────────────
// Pesquisa de imagens via Google Custom Search API (searchType=image).
// Requer no .env:
//   GOOGLE_SEARCH_KEY → chave da API (https://console.cloud.google.com, ativar "Custom Search API")
//   GOOGLE_SEARCH_CX  → ID do mecanismo de busca (https://programmablesearchengine.google.com,
//                       criar buscador com "Pesquisar em toda a web" + "Pesquisa de imagens" ativados)
// O proxy do Discord não busca imagens de qualquer host (hotlink protection),
// então baixamos a imagem no bot e anexamos via attachment://. Se o site
// bloquear o download, caímos para a thumbnail do Google (gstatic, sempre embeda).

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

async function searchImages(query: string): Promise<ImageResult[]> {
    const { data } = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
            key: process.env.GOOGLE_SEARCH_KEY,
            cx: process.env.GOOGLE_SEARCH_CX,
            q: query,
            searchType: 'image',
            num: MAX_RESULTS,
            safe: 'active',
            hl: 'pt-BR'
        },
        timeout: 10_000
    });

    return (data.items || []).map((item: any) => ({
        link: item.link,
        title: item.title || 'Sem título',
        contextLink: item.image?.contextLink || item.link,
        thumbnailLink: item.image?.thumbnailLink || '',
        width: item.image?.width || 0,
        height: item.image?.height || 0
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
    description: 'Pesquisa imagens no Google. Ex: rp!img seleção brasileira',
    aliases: ['imagem', 'image', 'googleimg'],

    async execute(message: Message, args: string[]) {
        const query = args.join(' ').trim();
        if (!query) {
            return message.reply('🔎 O que você quer procurar? Ex: `rp!img seleção brasileira`');
        }

        if (!process.env.GOOGLE_SEARCH_KEY || !process.env.GOOGLE_SEARCH_CX) {
            return message.reply('❌ Erro de configuração: `GOOGLE_SEARCH_KEY` e/ou `GOOGLE_SEARCH_CX` não estão no .env.');
        }

        if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
            await message.channel.sendTyping();
        }

        let results: ImageResult[];
        try {
            results = await searchImages(query);
        } catch (error: any) {
            const status = error?.response?.status;
            if (status === 429 || status === 403) {
                console.warn('[IMG] Cota da Custom Search API estourada ou chave inválida:', status);
                return message.reply('❌ A cota diária de pesquisas do Google acabou (ou a chave é inválida). Tente novamente amanhã.');
            }
            console.error('[IMG] Falha na pesquisa:', error?.message || error);
            return message.reply('❌ Não consegui falar com o Google agora. Tente de novo em instantes.');
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
                return i.reply({ content: '🔒 Só quem pesquisou pode navegar. Faça sua própria busca com `rp!img`!', ephemeral: true });
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
