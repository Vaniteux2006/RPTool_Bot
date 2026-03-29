import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config(); 

if (!process.env.DB_OC) console.warn("⚠️ AVISO: DB_OC não está no .env");
if (!process.env.DB_RESTANTE) console.warn("⚠️ AVISO: DB_RESTANTE não está no .env");

const OCConnection = mongoose.createConnection(process.env.DB_OC as string);

OCConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco de OCs'));
OCConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco de OCs:', err));

const mainConnection = mongoose.createConnection(process.env.DB_RESTANTE as string || process.env.DB_OC as string);

mainConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco Geral'));

const restanteConnection = mongoose.createConnection(process.env.DB_RESTANTE as string);

restanteConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco de Kanban'));
restanteConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco Kanban:', err));

export { OCConnection, mainConnection };
