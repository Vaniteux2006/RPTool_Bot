// RPTool/supercommands/help/guides/render.ts
// ─── Gera os PNGs dos guias (img/<id>.png) ────────────────────────────────────
// Ferramenta de desenvolvimento — o bot só lê os PNGs prontos. Rodar depois de
// mexer em ./data.ts ou ./template.ts:
//
//   npx ts-node --transpile-only supercommands/help/guides/render.ts [id ...]
//
// Sem ids, gera todos. Usa o Edge (ou Chrome) headless; caminho em BROWSER_PATH
// se não estiver no lugar padrão do Windows.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { GUIDES } from './data';
import { renderGuideHtml } from './template';

const WIDTH   = 1600;
const OUT_DIR = path.join(__dirname, 'img');

function findBrowser(): string {
    const candidates = [
        process.env.BROWSER_PATH,
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    ].filter(Boolean) as string[];
    const found = candidates.find(p => fs.existsSync(p));
    if (!found) throw new Error('Nenhum Edge/Chrome encontrado — defina BROWSER_PATH.');
    return found;
}

function headless(browser: string, extra: string[], url: string): string {
    return execFileSync(browser, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        '--log-level=3', ...extra, url,
    ], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function main() {
    const browser = findBrowser();
    const wanted  = process.argv.slice(2);
    const guides  = wanted.length ? GUIDES.filter(g => wanted.includes(g.id)) : GUIDES;
    const tmp     = fs.mkdtempSync(path.join(os.tmpdir(), 'rptool-guides-'));
    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const g of guides) {
        const htmlPath = path.join(tmp, `${g.id}.html`);
        fs.writeFileSync(htmlPath, renderGuideHtml(g), 'utf-8');
        const url = 'file:///' + htmlPath.replace(/\\/g, '/');

        // 1ª passada: mede a altura do conteúdo (o molde grava em <body data-h>).
        const dom    = headless(browser, [`--window-size=${WIDTH},900`, '--dump-dom'], url);
        const height = Number(/data-h="(\d+)"/.exec(dom)?.[1] ?? 1000);

        // 2ª passada: a foto, na altura exata.
        const out = path.join(OUT_DIR, `${g.id}.png`);
        headless(browser, [`--window-size=${WIDTH},${height}`, `--screenshot=${out}`], url);
        console.log(`🖼️  ${g.id}.png — ${WIDTH}×${height}`);
    }

    fs.rmSync(tmp, { recursive: true, force: true });
}

if (require.main === module) main();
