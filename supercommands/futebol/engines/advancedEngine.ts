import { ITeam } from '../../../tools/models/FutebolSchema';

export class AdvancedEngine {
    // Calcula a probabilidade de vitória baseada no overall médio
    static calculateWinChance(home: ITeam, away: ITeam): { homeChance: number, awayChance: number } {
        const homeAvg = home.players.reduce((acc, p) => acc + p.overall, 0) / (home.players.length || 1);
        const awayAvg = away.players.reduce((acc, p) => acc + p.overall, 0) / (away.players.length || 1);
        
        const diff = homeAvg - awayAvg;
        const base = 50;
        
        return {
            homeChance: Math.min(Math.max(base + (diff * 2), 10), 90),
            awayChance: Math.min(Math.max(base - (diff * 2), 10), 90)
        };
    }
}