import { Message, AttachmentBuilder } from 'discord.js';
import axios from 'axios';
import { EventCheckout } from '../tools/eventCheckout';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { semaphore } from '../tools/utils/pool';
import fs from 'fs';
import os from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

// ─── rp!download <link> ───────────────────────────────────────────────────────
// Baixa mídia de qualquer site e anexa no canal:
//   • Link direto de imagem/vídeo/áudio → download via axios
//   • Página de TikTok, X/Twitter, YouTube, Reddit, etc. → yt-dlp
// O binário standalone do yt-dlp é baixado do GitHub no boot (warmup) ou na
// primeira execução (fica em ./bin, sem depender de Python). Se o ffmpeg-static
// estiver instalado, é usado para juntar vídeo+áudio (ex: YouTube em HD).
// Overrides no .env:
//   YTDLP_PATH    → caminho para um binário próprio do yt-dlp
//   YTDLP_COOKIES → arquivo cookies.txt (formato Netscape) para sites que exigem
//                   login, como Instagram. Exporte com a extensão "Get cookies.txt"
//                   logado numa conta descartável.

const BIN_DIR  = path.join(process.cwd(), 'bin');
const BIN_PATH = path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const YTDLP_ASSET =
    process.platform === 'win32'  ? 'yt-dlp.exe'   :
    process.platform === 'darwin' ? 'yt-dlp_macos' :
    'yt-dlp_linux'; // standalone, não precisa de Python

const DOWNLOAD_TIMEOUT_MS = 4 * 60_000;
const downloadSlots = semaphore(2);

// ffmpeg é opcional: sem ele, só formatos de arquivo único (TikTok/Twitter ok)
let ffmpegPath: string | null = null;
try { ffmpegPath = require('ffmpeg-static'); } catch { /* segue sem ffmpeg */ }

// ─── Limite de upload do Discord conforme o boost do servidor ────────────────
function uploadLimitBytes(message: Message): number {
    const tier = message.guild?.premiumTier ?? 0;
    if (tier >= 3) return 100 * 1024 * 1024;
    if (tier >= 2) return 50 * 1024 * 1024;
    return 10 * 1024 * 1024;
}

// ─── Guarda anti-SSRF: só http(s) e nada de rede interna ─────────────────────
function validateUrl(raw: string): URL | null {
    let url: URL;
    try { url = new URL(raw); } catch { return null; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    const host = url.hostname.toLowerCase();
    const isPrivate =
        host === 'localhost' || host.endsWith('.local') || host === '[::1]' ||
        /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host) ||
        /^0\./.test(host);
    return isPrivate ? null : url;
}

// ─── Garante o binário do yt-dlp (baixa do GitHub na primeira vez) ───────────
let binPromise: Promise<string> | null = null;
async function ensureYtdlp(): Promise<string> {
    if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
    if (fs.existsSync(BIN_PATH)) return BIN_PATH;

    if (!binPromise) {
        binPromise = (async () => {
            console.log('[DOWNLOAD] Baixando binário do yt-dlp...');
            const { data } = await axios.get(
                `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${YTDLP_ASSET}`,
                { responseType: 'arraybuffer', timeout: 120_000, maxContentLength: 300 * 1024 * 1024 },
            );
            fs.mkdirSync(BIN_DIR, { recursive: true });
            fs.writeFileSync(BIN_PATH, Buffer.from(data));
            if (process.platform !== 'win32') fs.chmodSync(BIN_PATH, 0o755);
            console.log('[DOWNLOAD] yt-dlp pronto em', BIN_PATH);
            return BIN_PATH;
        })().catch(err => { binPromise = null; throw err; });
    }
    return binPromise;
}

// Cookies opcionais para sites que exigem login (Instagram, conteúdo restrito)
function cookieArgs(): string[] {
    const p = process.env.YTDLP_COOKIES;
    return p && fs.existsSync(p) ? ['--cookies', p] : [];
}

// ─── Warmup no boot ───────────────────────────────────────────────────────────
// Baixa o binário em background quando o bot conecta, para o primeiro
// rp!download não ter que esperar (no Discloud o ./bin zera a cada deploy).
// Se o binário já existe, tenta se auto-atualizar (-U) — sites quebram com
// frequência e o yt-dlp corrige rápido. Falhas aqui são silenciosas: o comando
// baixa on-demand de qualquer forma.
EventCheckout.onClientReady('download.ytdlpWarmup', async () => {
    try {
        const hadBinary = fs.existsSync(BIN_PATH);
        const bin = await ensureYtdlp();
        if (hadBinary && bin === BIN_PATH) {
            await execFileAsync(bin, ['-U'], { timeout: 120_000, maxBuffer: 1024 * 1024 });
        }
    } catch (err: any) {
        console.warn('[DOWNLOAD] Warmup do yt-dlp falhou (será baixado on-demand):', err?.message);
    }
});

const EXT_BY_MIME: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mp4': 'm4a',
};

// ─── Tenta baixar como arquivo direto (imagem/vídeo/áudio) ────────────────────
// Retorna null se o link for uma página (HTML) — aí é caso para o yt-dlp.
async function tryDirectDownload(url: URL, limit: number): Promise<{ buffer: Buffer, ext: string } | null> {
    const response = await axios.get(url.href, {
        responseType: 'arraybuffer',
        timeout: 30_000,
        maxContentLength: limit,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RPTool-Bot' },
    });
    const mime = String(response.headers['content-type'] || '').split(';')[0].trim();
    const ext  = EXT_BY_MIME[mime];
    if (!ext) return null;
    return { buffer: Buffer.from(response.data), ext };
}

// ─── Baixa via yt-dlp para um arquivo temporário ──────────────────────────────
async function ytdlpDownload(url: URL, limit: number, jobId: string): Promise<string | null> {
    const bin = await ensureYtdlp();
    const mb  = Math.max(1, Math.floor(limit / (1024 * 1024)));
    const outTemplate = path.join(os.tmpdir(), `rpdl_${jobId}.%(ext)s`);

    // Prioriza arquivo único que caiba no limite; com ffmpeg, tenta juntar
    // vídeo+áudio separados (YouTube HD) antes de cair no melhor arquivo único
    const format = ffmpegPath
        ? `b[filesize<${mb}M]/bv*[filesize_approx<${Math.floor(mb * 0.85)}M]+ba/b[filesize_approx<${mb}M]/b`
        : `b[filesize<${mb}M]/b[filesize_approx<${mb}M]/b`;

    const args = [
        url.href,
        '-f', format,
        '--max-filesize', `${mb}M`,
        '-o', outTemplate,
        '--no-playlist', '--playlist-items', '1',
        '--no-warnings', '--restrict-filenames',
        '--socket-timeout', '15',
        ...cookieArgs(),
    ];
    if (ffmpegPath) args.push('--ffmpeg-location', ffmpegPath, '--merge-output-format', 'mp4');

    await execFileAsync(bin, args, {
        timeout: DOWNLOAD_TIMEOUT_MS,
        killSignal: 'SIGKILL',
        maxBuffer: 10 * 1024 * 1024,
    });

    const file = fs.readdirSync(os.tmpdir()).find(f => f.startsWith(`rpdl_${jobId}.`));
    return file ? path.join(os.tmpdir(), file) : null;
}

function cleanupJob(jobId: string): void {
    try {
        for (const f of fs.readdirSync(os.tmpdir())) {
            if (f.startsWith(`rpdl_${jobId}.`)) fs.unlinkSync(path.join(os.tmpdir(), f));
        }
    } catch { /* best-effort */ }
}

function friendlyYtdlpError(error: any): string {
    const text = `${error?.stderr || ''} ${error?.message || ''}`;
    if (error?.killed)                          return '⏱️ O download demorou demais e foi cancelado (limite: 4 min).';
    if (/max-filesize/i.test(text))             return '❌ A mídia é maior que o limite de upload deste servidor.';
    if (/Unsupported URL/i.test(text))          return '❌ Esse site não é suportado. Funciona com links diretos de mídia e sites de vídeo (TikTok, X, YouTube, Reddit...).';
    if (/login|cookies|rate.?limit|403/i.test(text)) {
        return process.env.YTDLP_COOKIES
            ? '❌ O site bloqueou o download mesmo com cookies (conteúdo privado ou cookies expirados).'
            : '❌ O site bloqueou o download (conteúdo privado ou exige login — comum no Instagram).\n-# O dono do bot pode configurar `YTDLP_COOKIES` no .env para destravar.';
    }
    if (/Video unavailable|removed|private/i.test(text)) return '❌ Mídia indisponível, privada ou removida.';
    return '❌ Não consegui baixar essa mídia. O link é válido e público?';
}

export default {
    name: 'download',
    description: 'Baixa mídia de um link (imagem, vídeo de TikTok/X/YouTube...). Ex: rp!download <link>',
    aliases: ['dl', 'baixar'],

    async execute(message: Message, args: string[]) {
        const raw = args[0];
        if (!raw) {
            return message.reply('📥 **Uso:** `rp!download <link>`\nFunciona com links diretos de mídia e páginas de vídeo (TikTok, X/Twitter, YouTube, Reddit...).');
        }

        const url = validateUrl(raw.replace(/^<|>$/g, '')); // aceita link entre <> (sem embed)
        if (!url) return message.reply('❌ Link inválido. Use um endereço `http(s)` público.');

        if (!downloadSlots.tryAcquire()) {
            return message.reply('🚦 Já tem downloads demais em andamento. Tenta de novo em instantes.');
        }

        const limit  = uploadLimitBytes(message);
        const status = await message.reply('📥 Baixando mídia... isso pode levar um tempinho.');
        const jobId  = message.id;

        try {
            // 1) Link direto de imagem/vídeo/áudio → sem yt-dlp
            try {
                const direct = await tryDirectDownload(url, limit);
                if (direct) {
                    const file = new AttachmentBuilder(direct.buffer, { name: `download.${direct.ext}` });
                    return await status.edit({ content: `✅ Mídia baixada de \`${url.hostname}\`:`, files: [file] });
                }
            } catch (e: any) {
                if (String(e?.message).includes('maxContentLength')) {
                    return await status.edit('❌ O arquivo é maior que o limite de upload deste servidor.');
                }
                // Página bloqueou/robô detectado → deixa o yt-dlp tentar
            }

            // 2) Página de vídeo → yt-dlp
            const filePath = await ytdlpDownload(url, limit, jobId);
            if (!filePath) {
                return await status.edit('❌ O site não retornou nenhuma mídia que caiba no limite de upload deste servidor.');
            }

            const size = fs.statSync(filePath).size;
            if (size > limit) {
                return await status.edit(`❌ A mídia ficou com ${(size / 1024 / 1024).toFixed(1)}MB — acima do limite de ${(limit / 1024 / 1024).toFixed(0)}MB deste servidor.`);
            }

            const file = new AttachmentBuilder(filePath, { name: `download${path.extname(filePath)}` });
            await status.edit({ content: `✅ Mídia baixada de \`${url.hostname}\`:`, files: [file] });
        } catch (error: any) {
            console.error('[DOWNLOAD] Falha:', error?.stderr || error?.message || error);
            await status.edit(friendlyYtdlpError(error)).catch(() => {});
        } finally {
            downloadSlots.release();
            cleanupJob(jobId);
        }
    }
};
