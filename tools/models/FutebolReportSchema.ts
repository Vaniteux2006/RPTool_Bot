import mongoose, { Schema, Document } from 'mongoose';
import 'dotenv/config';

// ─── Conexão exclusiva para relatórios temporários (autodestroem após 48h) ───
const fbReportConnection = mongoose.createConnection(process.env.DB_FB_REPORT as string);
fbReportConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco de Relatórios (FB_REPORT)'));
fbReportConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco de Relatórios (FB_REPORT):', err));

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IMatchReport extends Document {
    guildId: string;
    tournamentId?: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    stats: {
        possessionHome: number;
        possessionAway: number;
        shotsHome: number;
        shotsAway: number;
        shotsOnTargetHome: number;
        shotsOnTargetAway: number;
        foulsHome: number;
        foulsAway: number;
        yellowCardsHome: number;
        yellowCardsAway: number;
        redCardsHome: number;
        redCardsAway: number;
        cornersHome: number;
        cornersAway: number;
        passAccuracyHome: number;
        passAccuracyAway: number;
    };
    homeFormation: string;
    awayFormation: string;
    homeTactic: string;
    awayTactic: string;
    eventsLog: string[];
    playerRatings: {
        team: string;
        playerName: string;
        rating: number;
    }[];
    topPerformerHome: string;
    topPerformerAway: string;
    createdAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const MatchReportSchema = new Schema<IMatchReport>({
    guildId:       { type: String, required: true, index: true },
    tournamentId:  { type: String },
    homeTeamName:  { type: String, required: true },
    awayTeamName:  { type: String, required: true },
    homeScore:     { type: Number, required: true },
    awayScore:     { type: Number, required: true },

    stats: {
        possessionHome:      { type: Number, default: 50 },
        possessionAway:      { type: Number, default: 50 },
        shotsHome:           { type: Number, default: 0 },
        shotsAway:           { type: Number, default: 0 },
        shotsOnTargetHome:   { type: Number, default: 0 },
        shotsOnTargetAway:   { type: Number, default: 0 },
        foulsHome:           { type: Number, default: 0 },
        foulsAway:           { type: Number, default: 0 },
        yellowCardsHome:     { type: Number, default: 0 },
        yellowCardsAway:     { type: Number, default: 0 },
        redCardsHome:        { type: Number, default: 0 },
        redCardsAway:        { type: Number, default: 0 },
        cornersHome:         { type: Number, default: 0 },
        cornersAway:         { type: Number, default: 0 },
        passAccuracyHome:    { type: Number, default: 80 },
        passAccuracyAway:    { type: Number, default: 80 },
    },

    homeFormation:    { type: String, default: '4-4-2' },
    awayFormation:    { type: String, default: '4-4-2' },
    homeTactic:       { type: String, default: 'BALANCEADO' },
    awayTactic:       { type: String, default: 'BALANCEADO' },
    eventsLog:        { type: [String], default: [] },
    playerRatings: [{
        team:       { type: String },
        playerName: { type: String },
        rating:     { type: Number },
    }],
    topPerformerHome: { type: String, default: '' },
    topPerformerAway: { type: String, default: '' },

    // ⚡ TTL INDEX — o MongoDB apaga sozinho 48h após criação
    createdAt: { type: Date, default: Date.now, expires: '48h' },
});

// ─── Export ───────────────────────────────────────────────────────────────────
export const MatchReportModel = fbReportConnection.model<IMatchReport>('FutebolMatchReport', MatchReportSchema);