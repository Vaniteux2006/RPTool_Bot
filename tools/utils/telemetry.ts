// RPTool/tools/utils/telemetry.ts
// ─── Telemetria para o RPTool-Watchdog ────────────────────────────────────────
// O Mongo (DB_STATUS) é o barramento entre o RPTool e o bot vigia. Este módulo:
//   1. HEARTBEAT   → upsert em `watchdog_heartbeat` a cada 20s com RAM, uptime,
//                    guilds, versão e commit. Vigia considera offline se >60s.
//   2. LOGS        → espelha console.log/warn/error num buffer e descarrega em
//                    lote a cada 10s em `watchdog_logs` (TTL 3 dias). Nunca
//                    escreve por linha — mesmo racional do statsBuffer.
//   3. DEPLOYS     → a cada boot, se versão/commit mudou desde o último registro,
//                    grava em `watchdog_deploys` (o vigia anuncia no canal).
//
// Auto-registra no ClientReady via EventCheckout — importado pelo bloco de
// auto-registro do commandCheckout. Sem DB_STATUS no .env, desativa-se sozinho.
import mongoose from 'mongoose';
import { inspect } from 'util';
import fs from 'fs';
import path from 'path';
import { EventCheckout } from '../eventCheckout';
import returnVersion from '../returnVersion';

const uri = process.env.DB_STATUS;

// Guarda referências originais ANTES de qualquer patch — o flush usa estas para
// reportar erros sem realimentar o próprio espelho (loop infinito).
const original = {
    log:   console.log.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
};

let HeartbeatModel: mongoose.Model<any> | null = null;
let LogModel:       mongoose.Model<any> | null = null;
let DeployModel:    mongoose.Model<any> | null = null;

if (uri) {
    const conn = mongoose.createConnection(uri);
    conn.on('error', (err) => original.error('❌ [Telemetry] Erro na conexão DB_STATUS:', err));

    HeartbeatModel = conn.model('WatchdogHeartbeat',
        new mongoose.Schema({}, { strict: false, collection: 'watchdog_heartbeat' }));

    const logSchema = new mongoose.Schema(
        { ts: Date, level: String, text: String },
        { collection: 'watchdog_logs', versionKey: false });
    logSchema.index({ ts: 1 }, { expireAfterSeconds: 3 * 24 * 3600 });
    LogModel = conn.model('WatchdogLog', logSchema);

    DeployModel = conn.model('WatchdogDeploy',
        new mongoose.Schema({}, { strict: false, collection: 'watchdog_deploys' }));
} else {
    original.warn('⚠️ [Telemetry] DB_STATUS ausente — telemetria do vigia desativada.');
}

// ─── Commit atual (best-effort: sem .git — ex: discloud — retorna null) ───────
function gitCommit(): string | null {
    try {
        const gitDir = path.join(__dirname, '..', '..', '.git');
        const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
        if (!head.startsWith('ref:')) return head.slice(0, 7);

        const ref = head.slice(5).trim();
        const refFile = path.join(gitDir, ref);
        if (fs.existsSync(refFile)) return fs.readFileSync(refFile, 'utf8').trim().slice(0, 7);

        // Refs podem estar compactadas em packed-refs
        const packed = fs.readFileSync(path.join(gitDir, 'packed-refs'), 'utf8');
        const line = packed.split('\n').find(l => l.endsWith(ref));
        return line ? line.slice(0, 7) : null;
    } catch { return null; }
}

// ─── Espelho de console ───────────────────────────────────────────────────────
const MAX_BUFFER = 500;   // válvula: descarta os mais antigos se o flush atrasar
const MAX_LINE   = 1500;

let logBuf: { ts: Date; level: string; text: string }[] = [];

function mirror(level: 'log' | 'warn' | 'error') {
    return (...args: any[]) => {
        original[level](...args);
        try {
            const text = args
                .map(a => typeof a === 'string' ? a : inspect(a, { depth: 2, breakLength: 120 }))
                .join(' ')
                .slice(0, MAX_LINE);
            logBuf.push({ ts: new Date(), level, text });
            if (logBuf.length > MAX_BUFFER) logBuf.splice(0, logBuf.length - MAX_BUFFER);
        } catch { /* espelho jamais pode derrubar um log */ }
    };
}

let flushing = false;
async function flushLogs(): Promise<void> {
    if (flushing || !LogModel || logBuf.length === 0) return;
    flushing = true;
    const batch = logBuf;
    logBuf = [];
    try {
        await LogModel.insertMany(batch, { ordered: false });
    } catch (err) {
        original.error('[Telemetry] Flush de logs falhou:', err);
    } finally {
        flushing = false;
    }
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────
async function beat(client: any): Promise<void> {
    if (!HeartbeatModel) return;
    const mem = process.memoryUsage();
    await HeartbeatModel.updateOne(
        { botId: 'rptool' },
        {
            $set: {
                botId:     'rptool',
                ts:        new Date(),
                rssMb:     Math.round(mem.rss / 1048576),
                heapMb:    Math.round(mem.heapUsed / 1048576),
                uptimeSec: Math.round(process.uptime()),
                guilds:    client.guilds.cache.size,
                wsPing:    client.ws.ping,
                version:   returnVersion(),
                commit:    gitCommit(),
            },
        },
        { upsert: true },
    ).catch(err => original.error('[Telemetry] Heartbeat falhou:', err));
}

// ─── Registro de deploy (versão/commit novos desde o último boot) ─────────────
async function registerDeploy(): Promise<void> {
    if (!DeployModel) return;
    try {
        const version = returnVersion();
        const commit  = gitCommit();
        const last    = await DeployModel.findOne().sort({ _id: -1 });
        if (last?.get('version') === version && last?.get('commit') === commit) return;
        await DeployModel.create({ version, commit, bootAt: new Date() });
    } catch (err) {
        original.error('[Telemetry] Registro de deploy falhou:', err);
    }
}

// ─── Inicialização ────────────────────────────────────────────────────────────
if (uri) {
    console.log = mirror('log');
    console.warn = mirror('warn');
    console.error = mirror('error');

    EventCheckout.onClientReady('system.telemetry', async (client) => {
        await registerDeploy();
        void beat(client);

        const beatTimer = setInterval(() => void beat(client), 20_000);
        beatTimer.unref();

        const flushTimer = setInterval(() => void flushLogs(), 10_000);
        flushTimer.unref();

        original.log('📡 [Telemetry] Heartbeat + espelho de logs ativos (DB_STATUS).');
    });
}
