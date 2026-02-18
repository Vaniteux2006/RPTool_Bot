import mongoose from 'mongoose';
import 'dotenv/config';

const statusConnection = mongoose.createConnection(process.env.DB_STATUS as string);

statusConnection.on('connected', () => {
    console.log('✅ [MongoDB] Conectado ao banco de Status');
});

statusConnection.on('error', (err) => {
    console.error('❌ [MongoDB] Erro ao conectar no banco de Status:', err);
});

const statSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    date: { type: String, required: true }, 
    hour: { type: Number, required: true }, 
    total: { type: Number, default: 0 },
    users: { type: Map, of: Number, default: {} },
    channels: { type: Map, of: Number, default: {} },
    words: { type: Map, of: Number, default: {} } // 
});

statSchema.index({ guildId: 1, date: 1, hour: 1 }, { unique: true });

export default statusConnection.model('ServerStats', statSchema);