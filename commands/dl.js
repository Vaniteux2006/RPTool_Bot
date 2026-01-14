
const { spawn, exec } = require('child_process'); 
const fs = require('fs');
const path = require('path');
const https = require('https');

// --- 1. FUNÇÃO DE DOWNLOAD DIRETO (Rápida e sem frescura) ---
function downloadDireto(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadDireto(response.headers.location, destPath).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

// --- 2. FUNÇÃO ESPECIAL PRO TIKTOK (Apoio Aéreo) ---
async function resolverTikTok(url) {
    try {
        // Usa a API do TikWM para pegar o link limpo (sem marca d'água e sem login)
        const response = await fetch(`https://www.tikwm.com/api/?url=${url}`);
        const data = await response.json();
        
        if (data.code === 0 && data.data && data.data.play) {
            return {
                tipo: 'video_tiktok',
                url: data.data.play, // Link direto do MP4
                desc: data.data.title || 'tiktok_video'
            };
        } else if (data.code === 0 && data.data && data.data.images) {
             // Caso seja slideshow de fotos no TikTok
             return {
                tipo: 'slideshow_tiktok',
                urls: data.data.images,
                desc: data.data.title || 'tiktok_slides'
             };
        }
        return null;
    } catch (e) {
        console.error("Erro na API TikTok:", e);
        return null;
    }
}

// --- 3. SONDA PADRÃO (Pra YouTube e Insta) ---
function checarExtensao(url, ytDlpPath) {
    return new Promise((resolve) => {
        const command = `"${ytDlpPath}" --print "%(ext)s" --print "%(vcodec)s" --no-warnings --flat-playlist --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${url}"`;
        
        exec(command, (error, stdout, stderr) => {
            const errText = stderr.toString();
            // Se der erro "no video", é imagem (Insta)
            if (errText.includes("no video") || errText.includes("GraphSidecar")) {
                return resolve({ tipo: 'imagem', ext: 'jpg' }); 
            }
            
            const lines = stdout.toString().trim().split('\n');
            const vcodec = lines[1] ? lines[1].trim() : 'none';

            if (vcodec !== 'none' && vcodec !== '(null)' && vcodec) {
                return resolve({ tipo: 'video', ext: lines[0] || 'mp4' });
            }
            return resolve({ tipo: 'imagem', ext: lines[0] || 'jpg' });
        });
    });
}

module.exports = {
    name: 'dl',
    description: 'Baixa TUDO: TikTok (Sem login), Insta (Mão Leve) e YouTube (Clássico)',
    async execute(message, args) {
        const url = args[0];
        if (!url) return message.reply("❌ Cadê o link?");

        const msg = await message.reply("🕵️‍♂️ **Analisando link...**");
        const filePrefix = `dl_${message.id}`;
        const rootDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(rootDir )) fs.mkdirSync(rootDir);

        // === ROTA 1: É TIKTOK? (Usa a API mágica) ===
        if (url.includes('tiktok.com')) {
            await msg.edit("🎵 **TikTok detectado!** Bypassing login...");
            const tkInfo = await resolverTikTok(url);

            if (tkInfo && tkInfo.tipo === 'video_tiktok') {
                const destPath = path.join(rootDir, `${filePrefix}.mp4`);
                try {
                    await downloadDireto(tkInfo.url, destPath);
                    return enviarArquivos(msg, filePrefix);
                } catch (e) {
                    console.log(e)
                    return msg.edit("❌ Erro ao baixar o arquivo do TikTok.");
                }
            } 
            else if (tkInfo && tkInfo.tipo === 'slideshow_tiktok') {
                await msg.edit(`📸 **Slideshow TikTok!** Baixando ${tkInfo.urls.length} fotos...`);
                // Baixa as 5 primeiras fotos max
                for (let i = 0; i < Math.min(tkInfo.urls.length, 5); i++) {
                    const destPath = path.join(rootDir, `${filePrefix}_${i}.jpg`);
                    await downloadDireto(tkInfo.urls[i], destPath);
                }
                return enviarArquivos(msg, filePrefix);
            }
            else {
                // Se a API falhar, cai pra ROTA 2 (tentativa desesperada com yt-dlp)
                console.log("API TikTok falhou, tentando yt-dlp...");
            }
        }

        // === ROTA 2: PADRÃO (Insta/YouTube via yt-dlp) ===
        let ytDlpPath = path.join(__dirname, 'dl/yt-dlp.exe'); // Padrão Windows Local
        
        if (process.platform !== 'win32') {
            ytDlpPath = 'yt-dlp'; 
        }

        const info = await checarExtensao(url, ytDlpPath);

        // CASO A: VÍDEO (YouTube / Insta Reels)
        if (info.tipo === 'video') {
            await msg.edit(`🎬 **Vídeo detectado!** Baixando MP4...`);
            const outputTemplate = path.join(rootDir, `${filePrefix}_%(autonumber)s.%(ext)s`);
            
            const processArgs = [
                '--no-warnings', '--max-filesize', '25M', '--playlist-items', '1,2,3',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                '--recode-video', 'mp4',
                '-o', outputTemplate,
                url
            ];
            
            spawn(ytDlpPath, processArgs).on('close', () => enviarArquivos(msg, filePrefix));
        } 
        
        // CASO B: IMAGEM (Instagram Foto)
        else {
            await msg.edit(`📸 **Imagem detectada!** Roubando URL direta...`);
            const cmdGetUrl = `"${ytDlpPath}" -g --no-warnings --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${url}"`;
            
            exec(cmdGetUrl, async (error, stdout, stderr) => {
                const links = stdout.trim().split('\n').filter(l => l.startsWith('http'));
                
                if (links.length === 0) {
                    // Última esperança: Força bruta
                    const outputTemplate = path.join(rootDir, `${filePrefix}_%(autonumber)s.jpg`);
                    const processArgs = ['--ignore-errors', '--no-warnings', '-o', outputTemplate, url];
                    spawn(ytDlpPath, processArgs).on('close', () => enviarArquivos(msg, filePrefix));
                    return;
                }

                await msg.edit(`📸 **Baixando ${links.length} imagem(ns)...**`);
                for (let i = 0; i < Math.min(links.length, 4); i++) {
                    const destPath = path.join(rootDir, `${filePrefix}_${i}.jpg`);
                    await downloadDireto(links[i], destPath).catch(e => console.log(e));
                }
                
                enviarArquivos(msg, filePrefix);
            });
        }
    }
};

// Função de Envio e Limpeza
async function enviarArquivos(msg, filePrefix) {
    const rootDir = path.join(__dirname, '../');
    const files = fs.readdirSync(rootDir);
    const foundFiles = files
        .filter(file => file.startsWith(filePrefix))
        .map(file => path.join(rootDir, file));

    if (foundFiles.length > 0) {
        try {
            await msg.edit({ content: `✅ **Pronto!**`, files: foundFiles });
            setTimeout(() => foundFiles.forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f) }), 5000);
        } catch (e) {
            msg.edit("❌ **Erro:** O arquivo é muito grande pro Discord (>25MB).");
            foundFiles.forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f) });
        }
    } else {
        msg.edit("❌ **Falha Total:** O site venceu. Não consegui pegar o arquivo.");
    }
}