import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config(); // Carrega o .env

// Verifica se as chaves estão no .env (pra não dar erro silencioso)
if (!process.env.DB_TUPPER) console.warn("⚠️ AVISO: DB_TUPPER não está no .env");
if (!process.env.DB_RESTANTE) console.warn("⚠️ AVISO: DB_RESTANTE não está no .env");

// 1. Conexão pro banco TUPPER (Separado)
const tupperConnection = mongoose.createConnection(process.env.DB_TUPPER as string);

tupperConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco de Tuppers'));
tupperConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco Tupper:', err));

// 2. Conexão pro banco GERAL (Resto do bot)
// Se não tiver DB_RESTANTE ainda, pode usar a mesma string do Tupper provisoriamente
const mainConnection = mongoose.createConnection(process.env.DB_RESTANTE as string || process.env.DB_TUPPER as string);

mainConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco Geral'));

// Exporta as conexões pra usar nos Models
export { tupperConnection, mainConnection };