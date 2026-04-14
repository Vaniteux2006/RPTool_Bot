import mongoose, { Schema, Document } from 'mongoose';
import 'dotenv/config';

// Conectando no banco restante (mesmo padrão do seu Kanban/Status)
const configConnection = mongoose.createConnection(process.env.DB_RESTANTE as string);

// --- INTERFACES ---
export interface IPlayer {
    name: string;
    position: 'GK' | 'DEF' | 'MID' | 'ATK';
    age: number;
    number: number;
    overall: number;
}

export interface ITeam extends Document {
    adminId: string; // Atrelado ao ID do usuário (funciona cross-server)
    name: string;
    logo: string;
    players: IPlayer[];
    createdAt: Date;
}

export interface IMatch extends Document {
    homeTeam: string; // Nome ou ID do time
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    isNeutral: boolean;
    date: Date;
}

// --- SCHEMAS ---
const PlayerSchema = new Schema<IPlayer>({
    name: { type: String, required: true },
    position: { type: String, enum: ['GK', 'DEF', 'MID', 'ATK'], required: true },
    age: { type: Number, default: 20 },
    number: { type: Number, default: 10 },
    overall: { type: Number, required: true, min: 1, max: 100 }
});

const TeamSchema = new Schema<ITeam>({
    adminId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    logo: { type: String, default: "" },
    players: { type: [PlayerSchema], default: [] },
    createdAt: { type: Date, default: Date.now }
});

const MatchSchema = new Schema<IMatch>({
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    homeScore: { type: Number, default: 0 },
    awayScore: { type: Number, default: 0 },
    isNeutral: { type: Boolean, default: false },
    date: { type: Date, default: Date.now, expires: '30d' } // Limpa logs antigos após 30 dias
});

// --- SCHEMA DE TORNEIOS ---
export interface ITournament extends Document {
    guildId: string;
    name: string;
    format: string; // Ex: 'BR', 'COPA'
    status: 'ENROLLING' | 'ACTIVE' | 'FINISHED';
    currentRound: number;
    teams: string[]; // IDs dos times inscritos
    standings: {
        teamId: string;
        points: number;
        games: number;
        wins: number;
        draws: number;
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
    }[];
}

const TournamentSchema = new Schema<ITournament>({
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    format: { type: String, required: true },
    status: { type: String, enum: ['ENROLLING', 'ACTIVE', 'FINISHED'], default: 'ENROLLING' },
    currentRound: { type: Number, default: 0 },
    teams: { type: [String], default: [] },
    
    // CORREÇÃO AQUI: Em vez de type: Array, passamos um array de objetos tipados
    standings: [{
        teamId: { type: String, required: true },
        points: { type: Number, default: 0 },
        games: { type: Number, default: 0 },
        wins: { type: Number, default: 0 },
        draws: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        goalsFor: { type: Number, default: 0 },
        goalsAgainst: { type: Number, default: 0 }
    }]
});

// Schema auxiliar para os jogos oficiais do torneio
const TourneyMatchSchema = new Schema({
    tournamentId: { type: String, required: true },
    round: { type: Number, required: true },
    homeTeamId: { type: String, required: true },
    awayTeamId: { type: String, required: true },
    homeScore: { type: Number, default: 0 },
    awayScore: { type: Number, default: 0 },
    status: { type: String, enum: ['PENDING', 'FINISHED', 'POSTPONED'], default: 'PENDING' }
});

export const TournamentModel = configConnection.model<ITournament>('FutebolTournament', TournamentSchema);
export const TourneyMatchModel = configConnection.model('FutebolTourneyMatch', TourneyMatchSchema);

export const TeamModel = configConnection.model<ITeam>('FutebolTeam', TeamSchema);
export const MatchModel = configConnection.model<IMatch>('FutebolMatch', MatchSchema);