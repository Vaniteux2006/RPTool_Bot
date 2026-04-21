import mongoose, { Schema, Document } from 'mongoose';
import 'dotenv/config';

const fbUserConnection = mongoose.createConnection(process.env.DB_FB_USER as string);
fbUserConnection.on('connected', () => console.log('✅ [MongoDB] Conectado ao banco Futebol (FB_USER)'));
fbUserConnection.on('error', (err) => console.error('❌ [MongoDB] Erro no banco Futebol (FB_USER):', err));

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface IPlayer {
    name: string;
    position: 'GK' | 'DEF' | 'MID' | 'ATK';
    age: number;
    number: number;
    overall: number;
    energy: number;
    sharpness: number;
    morale: number;
    archetype: string;
    isStarter: boolean;   // true = titular, false = reserva
}

export interface ITeam extends Document {
    adminId: string;
    name: string;
    logo: string;
    emoji: string;            // emoji associado ao clube (ex: "⚡", "🦅", "🔵")
    isGlobal: boolean;
    guildOriginId: string;
    defaultFormation: string;
    defaultTactic: string;
    players: IPlayer[];
    createdAt: Date;
}

export interface IStanding {
    teamId: string;
    teamName: string;         // nome cacheado — sobrevive a deleções do time
    teamEmoji: string;        // emoji cacheado
    points: number;
    games: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
}

export interface ITournamentGroup {
    name: string;             // "Grupo A", "Grupo B"…
    teamIds: string[];
}

export interface IBracketMatch {
    round: string;            // "Final", "Semifinal", "Quartas de Final"…
    position: number;         // índice dentro da rodada
    homeTeamId?: string;
    awayTeamId?: string;
    homeTeamName?: string;
    awayTeamName?: string;
    homeTeamEmoji?: string;
    awayTeamEmoji?: string;
    homeScore?: number;
    awayScore?: number;
    winnerId?: string;
    status: 'PENDING' | 'FINISHED';
}

export interface ITournament extends Document {
    guildId: string;
    name: string;
    format: string;
    phaseType: 'league' | 'groups' | 'knockout' | 'swiss';
    status: 'ENROLLING' | 'ACTIVE' | 'FINISHED';
    currentRound: number;
    totalRounds: number;
    teams: string[];
    standings: IStanding[];
    groups: ITournamentGroup[];
    bracket: IBracketMatch[];
    createdAt: Date;
}

export interface ITourneyMatch extends Document {
    tournamentId: string;
    round: number;
    groupName?: string;        // para fase de grupos
    bracketRound?: string;     // "Final", "Semifinal", "Quartas"…
    bracketPosition?: number;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    status: 'PENDING' | 'FINISHED' | 'POSTPONED';
    reportId?: string;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const PlayerSchema = new Schema<IPlayer>({
    name:      { type: String, required: true },
    position:  { type: String, enum: ['GK', 'DEF', 'MID', 'ATK'], required: true },
    age:       { type: Number, default: 20 },
    number:    { type: Number, default: 10 },
    overall:   { type: Number, required: true, min: 1, max: 100 },
    energy:    { type: Number, default: 100 },
    sharpness: { type: Number, default: 50 },
    morale:    { type: Number, default: 3 },
    archetype: { type: String, default: 'Balanceado' },
    isStarter: { type: Boolean, default: true },
}, { _id: false });

const StandingSchema = new Schema<IStanding>({
    teamId:       { type: String, required: true },
    teamName:     { type: String, default: 'Time Desconhecido' },
    teamEmoji:    { type: String, default: '⚽' },
    points:       { type: Number, default: 0 },
    games:        { type: Number, default: 0 },
    wins:         { type: Number, default: 0 },
    draws:        { type: Number, default: 0 },
    losses:       { type: Number, default: 0 },
    goalsFor:     { type: Number, default: 0 },
    goalsAgainst: { type: Number, default: 0 },
}, { _id: false });

const GroupSchema = new Schema<ITournamentGroup>({
    name:    { type: String },
    teamIds: { type: [String], default: [] },
}, { _id: false });

const BracketMatchSchema = new Schema<IBracketMatch>({
    round:         { type: String },
    position:      { type: Number },
    homeTeamId:    { type: String },
    awayTeamId:    { type: String },
    homeTeamName:  { type: String },
    awayTeamName:  { type: String },
    homeTeamEmoji: { type: String },
    awayTeamEmoji: { type: String },
    homeScore:     { type: Number },
    awayScore:     { type: Number },
    winnerId:      { type: String },
    status:        { type: String, enum: ['PENDING', 'FINISHED'], default: 'PENDING' },
}, { _id: false });

// ─── Team Schema ──────────────────────────────────────────────────────────────
const TeamSchema = new Schema<ITeam>({
    adminId:          { type: String, required: true, index: true },
    name:             { type: String, required: true },
    logo:             { type: String, default: 'https://i.imgur.com/vH1Wf2A.png' },
    emoji:            { type: String, default: '⚽' },
    guildOriginId:    { type: String, required: true, index: true },
    isGlobal:         { type: Boolean, default: false },
    defaultFormation: { type: String, default: '4-4-2' },
    defaultTactic:    { type: String, default: 'BALANCEADO' },
    players:          { type: [PlayerSchema], default: [] },
    createdAt:        { type: Date, default: Date.now },
});
TeamSchema.index({ name: 1, guildOriginId: 1 }, { unique: true, collation: { locale: 'pt', strength: 2 } });

// ─── Tournament Schema ────────────────────────────────────────────────────────
const TournamentSchema = new Schema<ITournament>({
    guildId:      { type: String, required: true, index: true },
    name:         { type: String, required: true },
    format:       { type: String, required: true },
    phaseType:    { type: String, enum: ['league', 'groups', 'knockout', 'swiss'], default: 'league' },
    status:       { type: String, enum: ['ENROLLING', 'ACTIVE', 'FINISHED'], default: 'ENROLLING' },
    currentRound: { type: Number, default: 0 },
    totalRounds:  { type: Number, default: 0 },
    teams:        { type: [String], default: [] },
    standings:    { type: [StandingSchema], default: [] },
    groups:       { type: [GroupSchema], default: [] },
    bracket:      { type: [BracketMatchSchema], default: [] },
    createdAt:    { type: Date, default: Date.now },
});

// ─── TourneyMatch Schema ──────────────────────────────────────────────────────
const TourneyMatchSchema = new Schema<ITourneyMatch>({
    tournamentId:    { type: String, required: true, index: true },
    round:           { type: Number, required: true },
    groupName:       { type: String },
    bracketRound:    { type: String },
    bracketPosition: { type: Number },
    homeTeamId:      { type: String, required: true },
    awayTeamId:      { type: String, required: true },
    homeScore:       { type: Number, default: 0 },
    awayScore:       { type: Number, default: 0 },
    status:          { type: String, enum: ['PENDING', 'FINISHED', 'POSTPONED'], default: 'PENDING' },
    reportId:        { type: String },
});

// ─── Exports ──────────────────────────────────────────────────────────────────
export const TeamModel         = fbUserConnection.model<ITeam>('FutebolTeam', TeamSchema);
export const TournamentModel   = fbUserConnection.model<ITournament>('FutebolTournament', TournamentSchema);
export const TourneyMatchModel = fbUserConnection.model<ITourneyMatch>('FutebolTourneyMatch', TourneyMatchSchema);