// RPTool/supercommands/exportchat/modules/cleanup.ts
// ─── Gerenciamento de pastas de sessão ───────────────────────────────────────
// Cada export cria uma pasta em /data/session_<userId>_<timestamp>/.
// Após envio, a pasta é deletada. Na inicialização, pastas órfãs (> 4h) são
// limpas automaticamente.

import fs   from 'fs';
import path from 'path';

export const DATA_DIR = path.join(__dirname, '..', 'data');

// ─── Garante que /data existe ─────────────────────────────────────────────────
export function ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Cria pasta de sessão ─────────────────────────────────────────────────────
export function createSessionDir(userId: string): string {
    ensureDataDir();
    const sessionName = `session_${userId}_${Date.now()}`;
    const sessionPath = path.join(DATA_DIR, sessionName);
    fs.mkdirSync(sessionPath, { recursive: true });
    return sessionPath;
}

// ─── Deleta pasta de sessão após envio ───────────────────────────────────────
export function deleteSession(sessionPath: string): void {
    try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
    } catch (e) {
        console.error('[exportchat] Erro ao deletar sessão:', sessionPath, e);
    }
}

// ─── Limpeza de sessões órfãs na inicialização ────────────────────────────────
// Chamado uma vez no boot pelo index.ts do exportchat.
// Deleta qualquer pasta em /data com mais de maxAgeHours horas.
export function cleanOrphanSessions(maxAgeHours = 4): void {
    ensureDataDir();
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    let cleaned = 0;
    for (const entry of fs.readdirSync(DATA_DIR)) {
        if (!entry.startsWith('session_')) continue;

        const fullPath = path.join(DATA_DIR, entry);
        try {
            const stat = fs.statSync(fullPath);
            if (now - stat.mtimeMs > maxAgeMs) {
                fs.rmSync(fullPath, { recursive: true, force: true });
                cleaned++;
            }
        } catch { /* pasta já foi deletada ou sem permissão */ }
    }

    if (cleaned > 0) {
        console.log(`🧹 [exportchat] ${cleaned} sessão(ões) órfã(s) limpas do /data`);
    }
}

// ─── Lista arquivos de output de uma sessão (ordenados) ──────────────────────
export function listOutputFiles(sessionPath: string): string[] {
    return fs.readdirSync(sessionPath)
        .filter(f => f.startsWith('output_'))
        .sort()
        .map(f => path.join(sessionPath, f));
}

// ─── Lista arquivos de segmento de uma sessão (ordenados cronologicamente) ───
export function listSegmentFiles(sessionPath: string): string[] {
    return fs.readdirSync(sessionPath)
        .filter(f => f.startsWith('seg_') && f.endsWith('.html'))
        .sort() // "seg_20240101.html" < "seg_20240102.html" — correto cronologicamente
        .map(f => path.join(sessionPath, f));
}
