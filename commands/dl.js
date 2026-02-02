const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https'); 
const { SlashCommandBuilder } = require('discord.js');

// --- CONFIGURAÇÕES ---
const TEMP_DIR = path.join(__dirname, '../temp');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

let ytDlpPath = path.join(__dirname, 'dl/yt-dlp.exe');
let handbrakePath = path.join(__dirname, 'dl/HandBrakeCLI.exe');
let cookiesPath = path.join(__dirname, 'dl/cookies.txt'); 

if (process.platform !== 'win32') {
    ytDlpPath = 'yt-dlp';
    handbrakePath = 'HandBrakeCLI';
    cookiesPath = 'cookies.txt'; 
}

// --- FUNÇÕES DE AJUDA ---

function criarBarraProgresso(porcentagem) {
    const total = 10;
    const progresso = Math.round((porcentagem / 100) * total);
    const safeProg = Math.max(0, Math.min(10, progresso));
    const vazia = total - safeProg;
    return '🟩'.repeat(safeProg) + '⬜'.repeat(vazia);
}

function downloadManual(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return downloadManual(response.headers.location, destPath).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(destPath); });
        }).on('error', (err) => { 
            fs.unlink(destPath, () => {}); 
            reject(err); 
        });
    });
}

function checarTipo(url) {
    return new Promise((resolve) => {
        let cmd = `"${ytDlpPath}" --print "vcodec" --no-warnings "${url}"`;
        if (fs.existsSync(cookiesPath)) cmd += ` --cookies "${cookiesPath}"`;

        exec(cmd, (error, stdout, stderr) => {
            if (stderr && (stderr.includes("login required") || stderr.includes("rate-limit"))) return resolve('LOGIN_REQUIRED');
            if (error || (stderr && stderr.includes("no video"))) return resolve('imagem'); 
            
            const vcodec = stdout.toString().trim();
            if (!vcodec || vcodec === 'none' || vcodec === '(null)') return resolve('imagem');
            return resolve('video');
        });
    });
}

function getDuration(filePath) {
    return new Promise((resolve) => {
        const cmd = `"${ytDlpPath}" --print duration --no-warnings "${filePath}"`;
        exec(cmd, (err, stdout) => {
            if (err || !stdout) return resolve(60); 
            const duration = parseFloat(stdout.trim());
            resolve(isNaN(duration) ? 60 : duration);
        });
    });
}

// BAIXAR IMAGEM
function baixarImagem(url, outputPath) {
    return new Promise((resolve, reject) => {
        const args = ['--no-warnings', '--force-overwrites', '-o', outputPath, url];
        if (fs.existsSync(cookiesPath)) { args.push('--cookies', cookiesPath); }

        const process = spawn(ytDlpPath, args);
        let stderrLog = "";
        process.stderr.on('data', d => stderrLog += d.toString());

        process.on('close', (code) => {
            if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath);
            else {
                // Plano B
                const cmdUrl = `"${ytDlpPath}" -g --no-warnings "${url}"` + (fs.existsSync(cookiesPath) ? ` --cookies "${cookiesPath}"` : "");
                exec(cmdUrl, async (err, stdout) => {
                    const directUrl = stdout.toString().trim().split('\n')[0];
                    if (directUrl && directUrl.startsWith('http')) {
                        try { await downloadManual(directUrl, outputPath); resolve(outputPath); } 
                        catch (manualErr) { reject(new Error(`Falha Plano B: ${manualErr.message}`)); }
                    } else {
                        reject(new Error("Falha total (Cookie inválido ou link privado)."));
                    }
                });
            }
        });
    });
}

// BAIXAR VÍDEO
function baixarComProgresso(url, outputPath, updateMsgFunc) {
    return new Promise((resolve, reject) => {
        const args = [
            '--no-warnings', '--force-overwrites', 
            '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '--recode-video', 'mp4',
            '-o', outputPath,
            url
        ];
        if (fs.existsSync(cookiesPath)) { args.push('--cookies', cookiesPath); }

        const process = spawn(ytDlpPath, args);
        let lastUpdate = 0;
        let stderrLog = "";

        process.stdout.on('data', (data) => {
            const text = data.toString();
            const match = text.match(/(\d+\.\d+)%/);
            if (match) {
                const percent = parseFloat(match[1]);
                const now = Date.now();
                if (now - lastUpdate > 3000 || percent === 100) {
                    lastUpdate = now;
                    updateMsgFunc(`📥 **Baixando vídeo...**\n${criarBarraProgresso(percent)} **${percent}%**`).catch(() => {});
                }
            }
        });

        process.stderr.on('data', (data) => stderrLog += data.toString());

        process.on('close', (code) => {
            if (code === 0) resolve(outputPath);
            else {
                if (stderrLog.includes("login required")) reject(new Error("INSTAGRAM_LOGIN"));
                else reject(new Error(`yt-dlp falhou. Verifique Cookies/Link.`));
            }
        });
    });
}

// COMPRESSÃO (Agora aceita um alvo "targetMB")
function comprimirComProgresso(inputPath, outputPath, updateMsgFunc, targetMB) {
    return new Promise(async (resolve, reject) => {
        const duration = await getDuration(inputPath);
        // Calcula bitrate baseado no alvo (targetMB)
        const targetBytes = targetMB * 1024 * 1024;
        const targetTotalBitrateKbps = (targetBytes * 8) / duration / 1000;
        const videoBitrate = Math.max(50, Math.floor(targetTotalBitrateKbps - 128));

        console.log(`[HandBrake] Alvo: ${targetMB}MB | Bitrate Calculado: ${videoBitrate}kbps`);

        const args = [
            '-i', inputPath, '-o', outputPath, '-f', 'mp4',
            '-b', videoBitrate.toString(), '-E', 'av_aac', '-B', '128', '--optimize'
        ];

        const hb = spawn(handbrakePath, args);
        let lastUpdate = 0;

        hb.stdout.on('data', (data) => {
            const text = data.toString();
            const match = text.match(/(\d+\.\d+) %/);
            if (match) {
                const percent = parseFloat(match[1]);
                const now = Date.now();
                if (now - lastUpdate > 3000 || percent > 99) {
                    lastUpdate = now;
                    updateMsgFunc(`⚖️ **Comprimindo (Meta: ${targetMB}MB)...**\n${criarBarraProgresso(percent)} **${percent}%**`).catch(() => {});
                }
            }
        });

        hb.on('close', (code) => {
            if (code === 0) resolve(outputPath);
            else reject(new Error(`HandBrake falhou código ${code}`));
        });
    });
}

// --- COMANDO PRINCIPAL ---

module.exports = {
    name: 'dl',
    description: 'Baixa mídia e tenta comprimir até caber.',

    data: new SlashCommandBuilder()
        .setName('dl')
        .setDescription('Baixar vídeo/imagem de links')
        .addStringOption(op => op.setName('link').setDescription('URL').setRequired(true)),

    async executeSlash(interaction) {
        const fakeMsg = {
            id: interaction.id, author: interaction.user, channel: interaction.channel,
            reply: async (c) => { await interaction.reply(c); return { edit: (n) => interaction.editReply(n) }; }
        };
        await this.execute(fakeMsg, [interaction.options.getString('link')]);
    },

    async execute(message, args) {
        const url = args[0];
        if (!url) return message.reply("❌ Cadê o link?");

        const msg = await message.reply("🕵️‍♂️ **Analisando...**");
        const userId = message.author.id; 
        const rawFile = path.join(TEMP_DIR, `${userId}_raw.mp4`);
        const finalFile = path.join(TEMP_DIR, `${userId}.mp4`);
        const imgFile = path.join(TEMP_DIR, `${userId}.jpg`); 

        const updateStatus = async (text) => { try { if (msg.edit) await msg.edit(text); } catch (e) { } };
        const limparTudo = () => {
            if (fs.existsSync(rawFile)) fs.unlinkSync(rawFile);
            if (fs.existsSync(finalFile)) fs.unlinkSync(finalFile);
            if (fs.existsSync(imgFile)) fs.unlinkSync(imgFile);
        };

        try {
            limparTudo();
            const tipo = await checarTipo(url);
            
            if (tipo === 'LOGIN_REQUIRED') throw new Error("INSTAGRAM_LOGIN");

            // === ROTA IMAGEM ===
            if (tipo === 'imagem') {
                await updateStatus("📸 **Foto detectada!**");
                await baixarImagem(url, imgFile);
                if (!fs.existsSync(imgFile)) throw new Error("Erro ao baixar imagem.");
                
                await msg.edit({ content: `✅ <@${userId}>`, files: [imgFile] });
                setTimeout(limparTudo, 5000);
                return;
            }

            // === ROTA VÍDEO (COM LÓGICA DE RETRY) ===
            await updateStatus("🎬 **Vídeo detectado! Baixando original...**");
            await baixarComProgresso(url, rawFile, updateStatus);

            if (!fs.existsSync(rawFile)) throw new Error("O vídeo não foi baixado.");
            
            const originalStats = fs.statSync(rawFile);
            let sizeMB = originalStats.size / (1024 * 1024);
            let fileToSend = rawFile;

            // Lógica Inteligente de Compressão
            if (sizeMB > 15.0) {
                // TENTATIVA 1: Mirar em 15MB
                await updateStatus(`⚖️ **Arquivo grande (${sizeMB.toFixed(1)}MB)! Comprimindo (Tentativa 1/2)...**`);
                try {
                    await comprimirComProgresso(rawFile, finalFile, updateStatus, 15.0);
                    
                    // Checa resultado
                    let finalSize = fs.statSync(finalFile).size / (1024 * 1024);
                    
                    if (finalSize > 25.0) {
                        // TENTATIVA 2: O arquivo ainda tá gordo. Vamos ser agressivos. Mirar em 10MB.
                        await updateStatus(`⚠️ **Ainda grande (${finalSize.toFixed(1)}MB)! Tentando comprimir mais forte (Tentativa 2/2)...**`);
                        
                        // Apaga a tentativa falha para não confundir
                        fs.unlinkSync(finalFile);
                        
                        // Comprime DE NOVO usando o original (rawFile)
                        await comprimirComProgresso(rawFile, finalFile, updateStatus, 10.0);
                    }

                    fileToSend = finalFile;
                } catch (e) {
                    console.error(e);
                    await updateStatus(`⚠️ **Erro na compressão.** Tentando enviar o original...`);
                    fileToSend = rawFile;
                }
            }

            // Verificação Final Pré-Envio
            if (!fs.existsSync(fileToSend)) throw new Error("Arquivo final sumiu.");
            const finalCheckSize = fs.statSync(fileToSend).size / (1024*1024);
            
            if (finalCheckSize > 25.0) {
                throw new Error(`MESMO COMPRIMINDO DUAS VEZES, AINDA FICOU COM ${finalCheckSize.toFixed(1)}MB. ESSE VÍDEO É O CHEFÃO FINAL! 🗿`);
            }

            await updateStatus("✅ **Enviando...**");
            await message.channel.send({ content: `✅ <@${userId}>`, files: [fileToSend] });
            await updateStatus("✅ **Pronto!**");

            setTimeout(limparTudo, 10000);

        } catch (error) {
            console.error(error);
            const errStr = (error.message || "").toLowerCase();
            let userMsg = `❌ **ERRO:** ${error.message}`;

            if (errStr.includes("instagram_login")) userMsg = "🔒 **Erro de Login:** O Instagram bloqueou. Verifique o `cookies.txt`.";
            if (errStr.includes("headerstimeout")) userMsg = "📡 **Erro de Internet:** O envio demorou demais.";
            if (errStr.includes("40005")) userMsg = "🐳 **Erro:** Arquivo > 25MB (Discord bloqueou).";

            await updateStatus(userMsg);
            limparTudo();
        }
    }
};