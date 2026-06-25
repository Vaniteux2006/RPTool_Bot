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
    words: { type: Map, of: Number, default: {} },
    ocs: { type: Map, of: Number, default: {} }
});

statSchema.index({ guildId: 1, date: 1, hour: 1 }, { unique: true });

const BlockedWordsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    words: { type: [String], default: [] }
});

// Cruzamento usuário × canal (agregado, não por hora) — alimentado em tempo real.
// Leve: um doc por (guildId, userId) com a contagem por canal. Usado para
// "canal favorito" no perfil/wrapped. Prospectivo (não é populado pelo backfill).
const userChannelSchema = new mongoose.Schema({
    guildId:  { type: String, required: true },
    userId:   { type: String, required: true },
    channels: { type: Map, of: Number, default: {} },
});
userChannelSchema.index({ guildId: 1, userId: 1 }, { unique: true });

// Cursor do backfill (docpast) — progresso por canal, para retomar de onde parou.
// beforeId = id da mensagem mais antiga já processada (próximo ponto de leitura "pra trás").
const backfillStateSchema = new mongoose.Schema({
    guildId:   { type: String, required: true },
    channelId: { type: String, required: true },
    beforeId:  { type: String, default: null },
    complete:  { type: Boolean, default: false },
});
backfillStateSchema.index({ guildId: 1, channelId: 1 }, { unique: true });

export const BlockedWordsModel = statusConnection.model('BlockedWords', BlockedWordsSchema);
export const UserChannelModel = statusConnection.model('UserChannelStats', userChannelSchema);
export const BackfillStateModel = statusConnection.model('BackfillState', backfillStateSchema);
export default statusConnection.model('ServerStats', statSchema);