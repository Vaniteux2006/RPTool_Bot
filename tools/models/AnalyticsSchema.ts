import mongoose from 'mongoose';
import 'dotenv/config';

const statusConnection = mongoose.createConnection(process.env.DB_STATUS as string);

const messageSchema = new mongoose.Schema({
userId: String,
channelId: String,
guildId: String,
timestamp: Number
});

const joinSchema = new mongoose.Schema({
guildId: String,
userId: String,
timestamp: Number
});

const voiceSchema = new mongoose.Schema({
guildId: String,
userId: String,
channelId: String,
joinTime: Number,
leaveTime: Number,
duration: Number
});

export const MessageModel = statusConnection.model('messages', messageSchema);
export const JoinModel = statusConnection.model('joins', joinSchema);
export const VoiceModel = statusConnection.model('voices', voiceSchema);