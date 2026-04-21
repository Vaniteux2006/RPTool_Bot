import { ITeam, IPlayer } from '../../../tools/models/FutebolSchema';

// ─── Arquétipos: como cada papel traduz o OVR em atributos Macro ──────────────
// Cada chave é um multiplicador aplicado ao OVR para derivar PAC/SHO/PAS/DRI/DEF/PHY
const ARCHETYPE_WEIGHTS: Record<string, Record<string, number>> = {
    'Muralha':    { PAC: 0.75, SHO: 0.20, PAS: 0.65, DRI: 0.50, DEF: 1.35, PHY: 1.25 }, // Goleiro campeão de área
    'Reflexo':    { PAC: 0.70, SHO: 0.15, PAS: 0.60, DRI: 0.45, DEF: 1.20, PHY: 1.00 }, // Goleiro de reflexo
    'Xerife':     { PAC: 0.70, SHO: 0.30, PAS: 0.70, DRI: 0.60, DEF: 1.40, PHY: 1.30 }, // Zagueiro central clássico
    'Construtor': { PAC: 0.75, SHO: 0.40, PAS: 1.10, DRI: 0.80, DEF: 1.10, PHY: 0.95 }, // Zagueiro que sai jogando
    'Lateral_Of': { PAC: 1.20, SHO: 0.60, PAS: 0.90, DRI: 1.00, DEF: 0.90, PHY: 0.80 }, // Lateral ofensivo
    'Trator':     { PAC: 0.85, SHO: 0.60, PAS: 0.80, DRI: 0.65, DEF: 1.20, PHY: 1.50 }, // Volante destroçador
    'Caixeiro':   { PAC: 0.90, SHO: 0.85, PAS: 1.05, DRI: 0.90, DEF: 0.90, PHY: 1.05 }, // Meia box-to-box
    'Maestro':    { PAC: 0.65, SHO: 0.80, PAS: 1.45, DRI: 1.20, DEF: 0.55, PHY: 0.65 }, // Camisa 10 armador
    'Velocista':  { PAC: 1.55, SHO: 0.90, PAS: 0.75, DRI: 1.30, DEF: 0.40, PHY: 0.60 }, // Ponta extremo
    'Dribblador': { PAC: 1.10, SHO: 0.85, PAS: 0.80, DRI: 1.50, DEF: 0.35, PHY: 0.55 }, // Ponta de habilidade
    'Matador':    { PAC: 0.90, SHO: 1.55, PAS: 0.65, DRI: 0.95, DEF: 0.30, PHY: 1.10 }, // Centroavante artilheiro
    'Pivô':       { PAC: 0.60, SHO: 1.20, PAS: 0.80, DRI: 0.80, DEF: 0.45, PHY: 1.60 }, // Centroavante de referência
    'Coringa':    { PAC: 1.05, SHO: 0.95, PAS: 0.95, DRI: 1.05, DEF: 0.75, PHY: 0.90 }, // Polivalente
    'Balanceado': { PAC: 1.00, SHO: 1.00, PAS: 1.00, DRI: 1.00, DEF: 1.00, PHY: 1.00 },
};

// Clamps um número entre min e max
function clamp(n: number, min = 1, max = 99): number {
    return Math.min(max, Math.max(min, Math.round(n)));
}

// ─── Overall Efetivo (leva em conta energia, ritmo e moral) ──────────────────
export function getEffectiveOverall(player: IPlayer): number {
    let ovr = player.overall;

    // Perna pesada: começa a punir abaixo de 70% de energia
    if (player.energy < 70) {
        ovr -= (70 - player.energy) * 0.35;
    }

    // Sharpness (ritmo de jogo): bônus se estiver afiado, punição se enferrujado
    if (player.sharpness >= 80) ovr += 2;
    else if (player.sharpness < 40) ovr -= 3;

    // Moral do vestiário
    switch (player.morale) {
        case 5: ovr += 3; break;   // Eufórico
        case 4: ovr += 1; break;   // Feliz
        case 3: break;             // Neutro
        case 2: ovr -= 2; break;   // Insatisfeito
        case 1: ovr -= 5; break;   // Crise
    }

    return clamp(ovr, 1, 99);
}

// ─── Atributos Macro do jogador (PAC, SHO, PAS, DRI, DEF, PHY) ──────────────
export function getPlayerMacros(player: IPlayer) {
    const ovr = getEffectiveOverall(player);
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

// ─── Força dos setores do time para o motor de simulação ─────────────────────
// Retorna: ataque (ATK), meio-campo (MID), defesa (DEF), goleiro (GK)
export function calculateTeamStats(team: ITeam): {
    ataque: number;
    meio: number;
    defesa: number;
    gk: number;
    avgOvr: number;
} {
    let atkScore = 0, midScore = 0, defScore = 0, gkScore = 0;
    let countAtk = 0, countMid = 0, countDef = 0;
    let totalOvr = 0;

    // Se o time não tem jogadores suficientes, preenche com "genéricos fracos"
    const players = team.players.length > 0 ? team.players : generateGenericPlayers(55);

    players.forEach(p => {
        const m = getPlayerMacros(p);
        totalOvr += getEffectiveOverall(p);

        switch (p.position) {
            case 'ATK':
                // Atacantes contribuem com SHO e DRI para o poder ofensivo
                atkScore += (m.SHO * 0.55) + (m.DRI * 0.25) + (m.PAC * 0.20);
                countAtk++;
                break;
            case 'MID':
                // Meias contribuem equilibradamente para todos os setores
                midScore += (m.PAS * 0.40) + (m.DRI * 0.30) + (m.DEF * 0.30);
                countMid++;
                break;
            case 'DEF':
                // Defensores contribuem com DEF e PHY
                defScore += (m.DEF * 0.55) + (m.PHY * 0.30) + (m.PAC * 0.15);
                countDef++;
                break;
            case 'GK':
                // Goleiro usa DEF como proxy dos reflexos
                gkScore += (m.DEF * 0.70) + (m.PHY * 0.30);
                break;
        }
    });

    // Média por setor. Se não há jogadores em algum setor, assume OVR genérico 40
    const FALLBACK = 40;
    const finalAtk = countAtk  > 0 ? atkScore  / countAtk  : FALLBACK;
    const finalMid = countMid  > 0 ? midScore  / countMid  : FALLBACK;
    const finalDef = countDef  > 0 ? defScore  / countDef  : FALLBACK;
    const finalGK  = gkScore   > 0 ? gkScore               : FALLBACK;
    const avgOvr   = players.length > 0 ? totalOvr / players.length : FALLBACK;

    return {
        ataque: finalAtk,
        meio:   finalMid,
        defesa: finalDef,
        gk:     finalGK,
        avgOvr,
    };
}

// ─── Calcula nota de um jogador após a partida ────────────────────────────────
export function calculatePlayerRating(params: {
    goals: number;
    assists: number;
    keyPasses: number;
    tacklesWon: number;
    errors: number;
    baseOvr: number;
    isWinner: boolean;
}): number {
    let rating = 6.0;

    rating += params.goals   * 1.20;
    rating += params.assists * 0.70;
    rating += params.keyPasses * 0.20;
    rating += params.tacklesWon * 0.15;
    rating -= params.errors * 0.40;

    if (params.isWinner) rating += 0.3;

    // Bônus/punição pelo OVR relativo (evita nota 10 para um OVR 40)
    if (params.baseOvr >= 85) rating += 0.3;
    if (params.baseOvr < 50)  rating -= 0.5;

    return parseFloat(Math.min(10, Math.max(1, rating)).toFixed(1));
}

// ─── Gera um plantel genérico para times sem jogadores ────────────────────────
export function generateGenericPlayers(ovr: number): IPlayer[] {
    const roster: IPlayer[] = [];
    const positions: Array<{ pos: IPlayer['position'], arch: string }> = [
        { pos: 'GK',  arch: 'Muralha'   },
        { pos: 'DEF', arch: 'Xerife'    },
        { pos: 'DEF', arch: 'Xerife'    },
        { pos: 'DEF', arch: 'Construtor'},
        { pos: 'DEF', arch: 'Lateral_Of'},
        { pos: 'MID', arch: 'Trator'    },
        { pos: 'MID', arch: 'Caixeiro'  },
        { pos: 'MID', arch: 'Maestro'   },
        { pos: 'ATK', arch: 'Velocista' },
        { pos: 'ATK', arch: 'Matador'   },
        { pos: 'ATK', arch: 'Dribblador'},
    ];

    positions.forEach((p, i) => {
        const variance = Math.floor(Math.random() * 7) - 3; // ±3
        roster.push({
            name:      `Jogador ${i + 1}`,
            position:  p.pos,
            age:       20,
            number:    i + 1,
            overall:   clamp(ovr + variance, 1, 99),
            energy:    100,
            sharpness: 50,
            morale:    3,
            archetype: p.arch,
            isStarter: true,
        });
    });

    return roster;
}