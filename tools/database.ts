import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config(); 

if (!process.env.DB_TUPPER) console.warn("⚠️ AVISO: DB_TUPPER não está no .env");
if (!process.env.DB_RESTANTE) console.warn("⚠️ AVISO: DB_RESTANTE não está no .env");

const tupperConnection = mongoose.createConnection(process.env.DB_TUPPER as string);

tupperConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco de Tuppers'));
tupperConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco Tupper:', err));

const mainConnection = mongoose.createConnection(process.env.DB_RESTANTE as string || process.env.DB_TUPPER as string);

mainConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco Geral'));

const restanteConnection = mongoose.createConnection(process.env.DB_RESTANTE as string);

restanteConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco de Kanban'));
restanteConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco Kanban:', err));

export { tupperConnection, mainConnection };
