// RPTool/tools/database.ts
// ─── Pool central de conexões Mongo ──────────────────────────────────────────
// Uma Connection por URI (não por arquivo!). Antes, cada model chamava o próprio
// mongoose.createConnection() — eram ~18 pools, sendo 8 para o MESMO DB_RESTANTE,
// cada um com maxPoolSize default de 100 sockets potenciais.
// Todos os models agora pedem getConnection(uri) e URIs iguais compartilham o pool.
import mongoose, { Connection } from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DB_OC) console.warn("⚠️ AVISO: DB_OC não está no .env");
if (!process.env.DB_RESTANTE) console.warn("⚠️ AVISO: DB_RESTANTE não está no .env");
if (!process.env.DB_OC_WIKI) console.warn("⚠️ AVISO: DB_OC_WIKI não está no .env");

const pools = new Map<string, Connection>();

export function getConnection(uri: string, label?: string): Connection {
    const existing = pools.get(uri);
    if (existing) return existing;

    const conn = mongoose.createConnection(uri, { maxPoolSize: 10 });
    const tag = label ?? `pool ${pools.size + 1}`;
    conn.on('connected', () => console.log(`✅ [MongoDB] Conectado (${tag})`));
    conn.on('error', (err) => console.error(`❌ [MongoDB] Erro (${tag}):`, err));
    pools.set(uri, conn);
    return conn;
}

// ─── Conexões nomeadas (compatibilidade com os imports existentes) ────────────
// mainConnection e restanteConnection apontam pro MESMO pool (mesma URI).
export const OCConnection   = getConnection(process.env.DB_OC as string, 'OCs');
export const WikiConnection = getConnection(process.env.DB_OC_WIKI as string, 'Wiki');
export const mainConnection = getConnection(process.env.DB_RESTANTE as string || process.env.DB_OC as string, 'Geral');
