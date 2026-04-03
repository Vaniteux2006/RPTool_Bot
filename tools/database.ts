// RPTool/tools/database.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config(); 

if (!process.env.DB_OC) console.warn("⚠️ AVISO: DB_OC não está no .env");
if (!process.env.DB_RESTANTE) console.warn("⚠️ AVISO: DB_RESTANTE não está no .env");
if (!process.env.DB_OC_WIKI) console.warn("⚠️ AVISO: DB_OC_WIKI não está no .env"); // ⬅️ Novo aviso caso falte no .env

// --- CONEXÃO OCs (Leve) ---
const OCConnection = mongoose.createConnection(process.env.DB_OC as string);
OCConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco de OCs'));
OCConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco de OCs:', err));

// --- CONEXÃO WIKI (Pesada) ---
const WikiConnection = mongoose.createConnection(process.env.DB_OC_WIKI as string); // ⬅️ Nova ligação exclusiva da Wiki
WikiConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco da Wiki'));
WikiConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco da Wiki:', err));

// --- CONEXÃO PRINCIPAL (Restante) ---
const mainConnection = mongoose.createConnection(process.env.DB_RESTANTE as string || process.env.DB_OC as string);
mainConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco Geral'));

// --- CONEXÃO KANBAN ---
const restanteConnection = mongoose.createConnection(process.env.DB_RESTANTE as string);
restanteConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco de Kanban'));
restanteConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco Kanban:', err));

// ⬅️ Exportamos a WikiConnection no final para que o OCSchema.ts possa usá-la
export { OCConnection, mainConnection, WikiConnection };