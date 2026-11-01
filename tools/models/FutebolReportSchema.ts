import { getConnection } from '../database';
import mongoose, { Schema, Document } from 'mongoose';
import 'dotenv/config';

// ─── Conexão exclusiva para relatórios temporários (autodestroem após 48h) ───
const fbReportConnection = getConnection(process.env.DB_FB_REPORT as string, 'FutebolReport');
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
        yellowCardsHome: number;
        yellowCardsAway: number;
        redCardsHome: number;
        redCardsAway: number;
        tacklesHome: number;
        tacklesAway: number;
        passErrorsHome: number;
        passErrorsAway: number;
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
        isSub?: boolean;
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
        yellowCardsHome:     { type: Number, default: 0 },
        yellowCardsAway:     { type: Number, default: 0 },
        redCardsHome:        { type: Number, default: 0 },
        redCardsAway:        { type: Number, default: 0 },
        tacklesHome:         { type: Number, default: 0 },
        tacklesAway:         { type: Number, default: 0 },
        passErrorsHome:      { type: Number, default: 0 },
        passErrorsAway:      { type: Number, default: 0 },
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
        isSub:      { type: Boolean, default: false },
    }],
    topPerformerHome: { type: String, default: '' },
    topPerformerAway: { type: String, default: '' },

    // ⚡ TTL INDEX — o MongoDB apaga sozinho 48h após criação
    createdAt: { type: Date, default: Date.now, expires: '48h' },
});

// ─── Export ───────────────────────────────────────────────────────────────────
export const MatchReportModel = fbReportConnection.model<IMatchReport>('FutebolMatchReport', MatchReportSchema);