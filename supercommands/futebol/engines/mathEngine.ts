// RPTool/supercommands/futebol/engines/mathEngine.ts
import { ITeam, IPlayer } from '../../../tools/models/FutebolSchema';

// ─── Arquétipos: multiplicadores PAC/SHO/PAS/DRI/DEF/PHY por arquétipo ────────
const ARCHETYPE_WEIGHTS: Record<string, Record<string, number>> = {
    'Muralha':    { PAC: 0.75, SHO: 0.20, PAS: 0.65, DRI: 0.50, DEF: 1.35, PHY: 1.25 },
    'Reflexo':    { PAC: 0.70, SHO: 0.15, PAS: 0.60, DRI: 0.45, DEF: 1.20, PHY: 1.00 },
    'Xerife':     { PAC: 0.70, SHO: 0.30, PAS: 0.70, DRI: 0.60, DEF: 1.40, PHY: 1.30 },
    'Construtor': { PAC: 0.75, SHO: 0.40, PAS: 1.10, DRI: 0.80, DEF: 1.10, PHY: 0.95 },
    'Lateral_Of': { PAC: 1.20, SHO: 0.60, PAS: 0.90, DRI: 1.00, DEF: 0.90, PHY: 0.80 },
    'Trator':     { PAC: 0.85, SHO: 0.60, PAS: 0.80, DRI: 0.65, DEF: 1.20, PHY: 1.50 },
    'Caixeiro':   { PAC: 0.90, SHO: 0.85, PAS: 1.05, DRI: 0.90, DEF: 0.90, PHY: 1.05 },
    'Maestro':    { PAC: 0.65, SHO: 0.80, PAS: 1.45, DRI: 1.20, DEF: 0.55, PHY: 0.65 },
    'Velocista':  { PAC: 1.55, SHO: 0.90, PAS: 0.75, DRI: 1.30, DEF: 0.40, PHY: 0.60 },
    'Dribblador': { PAC: 1.10, SHO: 0.85, PAS: 0.80, DRI: 1.50, DEF: 0.35, PHY: 0.55 },
    'Matador':    { PAC: 0.90, SHO: 1.55, PAS: 0.65, DRI: 0.95, DEF: 0.30, PHY: 1.10 },
    'Pivô':       { PAC: 0.60, SHO: 1.20, PAS: 0.80, DRI: 0.80, DEF: 0.45, PHY: 1.60 },
    'Coringa':    { PAC: 1.05, SHO: 0.95, PAS: 0.95, DRI: 1.05, DEF: 0.75, PHY: 0.90 },
    'Balanceado': { PAC: 1.00, SHO: 1.00, PAS: 1.00, DRI: 1.00, DEF: 1.00, PHY: 1.00 },
};

function clamp(n: number, min = 1, max = 99): number {
    return Math.min(max, Math.max(min, Math.round(n)));
}

// ─── Verifica se um jogador tem stats customizados completos ──────────────────
export function hasCustomStats(player: IPlayer): boolean {
    if (player.position === 'GK') {
        return player.div != null && player.ref != null;
    }
    return player.pac != null && player.sho != null;
}

// ─── Overall Efetivo (energia + sharpness + morale) ──────────────────────────
export function getEffectiveOverall(player: IPlayer): number {
    let ovr = player.overall;
    if (player.energy < 70) ovr -= (70 - player.energy) * 0.35;
    if (player.sharpness >= 80) ovr += 2;
    else if (player.sharpness < 40) ovr -= 3;
    switch (player.morale) {
        case 5: ovr += 3; break;
        case 4: ovr += 1; break;
        case 2: ovr -= 2; break;
        case 1: ovr -= 5; break;
    }
    return clamp(ovr, 1, 99);
}

// ─── Atributos Macro para o motor de simulação ───────────────────────────────
// Prioridade: 1) stats customizados | 2) arquétipo × OVR
export function getPlayerMacros(player: IPlayer): {
    PAC: number; SHO: number; PAS: number; DRI: number; DEF: number; PHY: number;
} {
    // Aplicar penalidade de fadiga proporcional sobre stats customizados
    const fatigueMult = player.energy < 70 ? 1 - ((70 - player.energy) / 200) : 1.0;

    if (hasCustomStats(player)) {
        if (player.position === 'GK') {
            // GK: converte stats específicos para as 6 categorias do motor
            // DEF do motor = média de Mergulho + Reflexo + Posicionamento
            const div = player.div ?? 50;
            const ref = player.ref ?? 50;
            const han = player.han ?? 50;
            const kic = player.kic ?? 50;
            const spe = player.spe ?? 50;
            const pos = player.pos ?? 50;

            return {
                PAC: clamp(spe * fatigueMult),
                SHO: clamp(kic * fatigueMult),
                PAS: clamp(kic * fatigueMult),
                DRI: clamp(pos * fatigueMult),
                DEF: clamp(((div + ref + pos) / 3) * fatigueMult),
                PHY: clamp(han * fatigueMult),
            };
        } else {
            // Outfield: usa stats diretamente
            return {
                PAC: clamp((player.pac ?? 50) * fatigueMult),
                SHO: clamp((player.sho ?? 50) * fatigueMult),
                PAS: clamp((player.pas ?? 50) * fatigueMult),
                DRI: clamp((player.dri ?? 50) * fatigueMult),
                DEF: clamp((player.def ?? 50) * fatigueMult),
                PHY: clamp((player.phy ?? 50) * fatigueMult),
            };
        }
    }

    // Fallback: deriva stats do OVR × pesos do arquétipo
    const ovr     = getEffectiveOverall(player);
    const weights = ARCHETYPE_WEIGHTS[player.archetype] ?? ARCHETYPE_WEIGHTS['Balanceado'];
    return {
        PAC: clamp(ovr * weights.PAC),
        SHO: clamp(ovr * weights.SHO),
        PAS: clamp(ovr * weights.PAS),
        DRI: clamp(ovr * weights.DRI),
        DEF: clamp(ovr * weights.DEF),
        PHY: clamp(ovr * weights.PHY),
    };
}

// ─── Calcula OVR a partir de stats customizados ───────────────────────────────
// Pesos por posição (inspirados na fórmula do FIFA Ultimate Team)
export function calculateOverallFromStats(position: string, stats: Partial<{
    pac: number; sho: number; pas: number; dri: number; def: number; phy: number;
    div: number; ref: number; han: number; kic: number; spe: number; pos: number;
}>): number {
    const s = (k: keyof typeof stats) => stats[k] ?? 50;

    switch (position) {
        case 'GK':
            // DIV/REF pesam mais (saves), HAN e POS são secundários
            return clamp(Math.round(
                s('div') * 0.22 + s('ref') * 0.22 + s('han') * 0.18 +
                s('pos') * 0.18 + s('kic') * 0.12 + s('spe') * 0.08
            ), 1, 99);

        case 'ATK':
            // Finalização e drible dominam
            return clamp(Math.round(
                s('sho') * 0.45 + s('pac') * 0.20 + s('dri') * 0.18 +
                s('pas') * 0.08 + s('phy') * 0.05 + s('def') * 0.04
            ), 1, 99);

        case 'MID':
            // Passe, drible e finalização em equilíbrio
            return clamp(Math.round(
                s('pas') * 0.30 + s('dri') * 0.25 + s('sho') * 0.20 +
                s('def') * 0.10 + s('pac') * 0.08 + s('phy') * 0.07
            ), 1, 99);

        case 'DEF':
            // Defesa e físico dominam
            return clamp(Math.round(
                s('def') * 0.45 + s('phy') * 0.25 + s('pac') * 0.15 +
                s('pas') * 0.08 + s('dri') * 0.05 + s('sho') * 0.02
            ), 1, 99);

        default:
            return 50;
    }
}

// ─── Força dos setores do time ────────────────────────────────────────────────
export function calculateTeamStats(team: ITeam): {
    ataque: number; meio: number; defesa: number; gk: number; avgOvr: number;
} {
    let atkScore = 0, midScore = 0, defScore = 0, gkScore = 0;
    let countAtk = 0, countMid = 0, countDef = 0;
    let totalOvr = 0;

    const players = team.players.length > 0 ? team.players : generateGenericPlayers(55);

    players.forEach(p => {
        const m = getPlayerMacros(p);
        totalOvr += getEffectiveOverall(p);
        switch (p.position) {
            case 'ATK': atkScore += (m.SHO * 0.55) + (m.DRI * 0.25) + (m.PAC * 0.20); countAtk++; break;
            case 'MID': midScore += (m.PAS * 0.40) + (m.DRI * 0.30) + (m.DEF * 0.30); countMid++; break;
            case 'DEF': defScore += (m.DEF * 0.55) + (m.PHY * 0.30) + (m.PAC * 0.15); countDef++; break;
            case 'GK':  gkScore  += (m.DEF * 0.70) + (m.PHY * 0.30); break;
        }
    });

    const FB = 40;
    return {
        ataque: countAtk > 0 ? atkScore / countAtk : FB,
        meio:   countMid > 0 ? midScore / countMid : FB,
        defesa: countDef > 0 ? defScore / countDef : FB,
        gk:     gkScore  > 0 ? gkScore             : FB,
        avgOvr: players.length > 0 ? totalOvr / players.length : FB,
    };
}

// ─── Nota individual pós-partida ──────────────────────────────────────────────
export function calculatePlayerRating(params: {
    goals: number; assists: number; keyPasses: number;
    tacklesWon: number; errors: number; baseOvr: number; isWinner: boolean;
}): number {
    let r = 6.0;
    r += params.goals       * 1.20;
    r += params.assists     * 0.70;
    r += params.keyPasses   * 0.20;
    r += params.tacklesWon  * 0.15;
    r -= params.errors      * 0.40;
    if (params.isWinner)        r += 0.3;
    if (params.baseOvr >= 85)   r += 0.3;
    if (params.baseOvr <  50)   r -= 0.5;
    return parseFloat(Math.min(10, Math.max(1, r)).toFixed(1));
}

// ─── Plantel genérico (fallback) ──────────────────────────────────────────────
export function generateGenericPlayers(ovr: number): IPlayer[] {
    const positions: Array<{ pos: IPlayer['position']; arch: string }> = [
        { pos: 'GK',  arch: 'Muralha'    },
        { pos: 'DEF', arch: 'Xerife'     }, { pos: 'DEF', arch: 'Xerife'     },
        { pos: 'DEF', arch: 'Construtor' }, { pos: 'DEF', arch: 'Lateral_Of' },
        { pos: 'MID', arch: 'Trator'     }, { pos: 'MID', arch: 'Caixeiro'   }, { pos: 'MID', arch: 'Maestro' },
        { pos: 'ATK', arch: 'Velocista'  }, { pos: 'ATK', arch: 'Matador'    }, { pos: 'ATK', arch: 'Dribblador' },
    ];

    return positions.map((p, i) => ({
        name:      `Jogador ${i + 1}`,
        position:  p.pos,
        age:       20,
        number:    i + 1,
        overall:   clamp(ovr + Math.floor(Math.random() * 7) - 3, 1, 99),
        energy:    100,
        sharpness: 50,
        morale:    3,
        archetype: p.arch,
        isStarter: true,
    }));
}