import { getConnection } from '../database';
import mongoose from 'mongoose';
import 'dotenv/config';

const restanteConnection = getConnection(process.env.DB_RESTANTE as string, 'Geral');

restanteConnection.on('connected', () => {
    console.log('✅ [MongoDB] Conectado ao banco Restante (Sistemas Gerais)');
});

const BotStatusSchema = new mongoose.Schema({
    content: { type: String, required: true },
    type: { type: String, required: true }
});

// Modo do rotator de status: 'rotate' sorteia da collection BotStatus a cada
// 15s (comportamento clássico); 'fixed' congela em content/type deste doc sem
// destruir o rodízio. Gerenciável remotamente pelo Watchdog (wd!setstatus).
const BotStatusConfigSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // sempre 'main'
    mode: { type: String, enum: ['rotate', 'fixed'], default: 'rotate' },
    content: { type: String, default: null },
    type: { type: String, default: 'Playing' },
});

const WikiArticleSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    paragraphs: { type: [String], required: true }
});

const PhoneRegistrySchema = new mongoose.Schema({
    serverId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    marker: { type: String, default: null }
});


const WelcomeSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, default: null },
    joinMsg: { type: String, default: "🎉 Bem-vindo(a) {user} ao servidor **{server}**! Agora somos {count} membros." },
    leaveMsg: { type: String, default: "🚶 {user} arrumou as malas e saiu do servidor." },
    kickMsg: { type: String, default: "👟 {user} foi expulso(a) do servidor a pontapés!" },
    banMsg: { type: String, default: "🔨 {user} tomou o martelo do ban e não volta mais." }
});

export const WelcomeModel = restanteConnection.model('WelcomeConfig', WelcomeSchema);
export const BotStatusModel = restanteConnection.model('BotStatus', BotStatusSchema);
export const BotStatusConfigModel = restanteConnection.model('BotStatusConfig', BotStatusConfigSchema);
export const WikiArticleModel = restanteConnection.model('WikiArticle', WikiArticleSchema);
export const PhoneRegistryModel = restanteConnection.model('PhoneRegistry', PhoneRegistrySchema);