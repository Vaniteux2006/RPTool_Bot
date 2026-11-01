// RPTool/supercommands/futebol/engines/brasfoot/tables.ts
// Números e fórmulas do Brasfoot (via Vanifoot: src/engine/original.ts, development.ts, match.ts).
// Os nomes entre parênteses apontam para onde cada um vive no original descompilado.

export type Sector = 'GK' | 'DEF' | 'MID' | 'ATK';

// ─── Vagas do campo (aq.sE) ───────────────────────────────────────────────────
// 1 goleiro; 2 e 9 laterais; 3–8 zagueiros; 10 e 17 alas; 11–13 volantes;
// 14–16 meias; 18 e 25 pontas; 19–24 centroavantes.
// O RPTool só conhece setores, então a vaga pede um setor (não L/Z como no original):
// 2–9 DEF, 10–17 MID, 18–25 ATK.
export function sectorOf(slot: number): Sector {
    if (slot <= 1)  return 'GK';
    if (slot <= 9)  return 'DEF';
    if (slot <= 17) return 'MID';
    return 'ATK';
}

/** f_0.gF(): jogador fora do setor da vaga joga com metade da força. */
export const outOfPosition = (slot: number, pos: Sector) => sectorOf(slot) !== pos;

// ─── Esquemas (aq.sJ) ─────────────────────────────────────────────────────────
// As 32 formações do tactics.json, com a vaga de cada titular. Os do original
// (4-4-2, 4-3-3, 4-5-1, 5-4-1, 5-3-2, 3-5-2, 3-4-3, 4-2-3-1) mantêm as vagas de lá.
const D3 = [4, 6, 8];
const D4 = [2, 9, 6, 8];
const D5 = [2, 9, 4, 6, 8];
export const FORMATION_SLOTS: Record<string, number[]> = {
    '3-1-4-2':       [1, ...D3, 12, 10, 14, 16, 17, 22, 24],
    '3-4-1-2':       [1, ...D3, 10, 11, 13, 17, 15, 22, 24],
    '3-4-2-1':       [1, ...D3, 10, 11, 13, 17, 14, 16, 23],
    '3-4-3':         [1, ...D3, 10, 11, 13, 17, 18, 23, 25],
    '3-5-2':         [1, ...D3, 10, 11, 13, 15, 17, 22, 24],
    '4-1-2-1-2':     [1, ...D4, 12, 14, 16, 15, 22, 24],
    '4-1-2-1-2_(2)': [1, ...D4, 12, 10, 17, 15, 22, 24],
    '4-1-3-2':       [1, ...D4, 12, 10, 15, 17, 22, 24],
    '4-1-4-1':       [1, ...D4, 12, 10, 14, 16, 17, 23],
    '4-2-1-3':       [1, ...D4, 11, 13, 15, 18, 23, 25],
    '4-2-2-2':       [1, ...D4, 11, 13, 14, 16, 22, 24],
    '4-2-3-1':       [1, ...D4, 11, 13, 14, 15, 16, 23],
    '4-2-3-1_(2)':   [1, ...D4, 11, 13, 10, 15, 17, 20],
    '4-2-4':         [1, ...D4, 11, 13, 18, 22, 24, 25],
    '4-3-1-2':       [1, ...D4, 11, 12, 13, 15, 22, 24],
    '4-3-2-1':       [1, ...D4, 11, 12, 13, 14, 16, 23],
    '4-3-3':         [1, ...D4, 12, 14, 16, 22, 23, 24],
    '4-3-3_(2)':     [1, ...D4, 11, 13, 15, 19, 20, 21],
    '4-3-3_(3)':     [1, ...D4, 12, 14, 16, 18, 23, 25],
    '4-3-3_(4)':     [1, ...D4, 11, 12, 13, 18, 23, 25],
    '4-3-3_(5)':     [1, ...D4, 14, 15, 16, 18, 23, 25],
    '4-4-1-1':       [1, ...D4, 10, 11, 13, 17, 15, 23],
    '4-4-1-1_(2)':   [1, ...D4, 11, 13, 14, 16, 15, 23],
    '4-4-2':         [1, ...D4, 11, 13, 14, 16, 22, 24],
    '4-4-2_(2)':     [1, ...D4, 11, 12, 13, 15, 19, 21],
    '4-5-1':         [1, ...D4, 10, 11, 13, 15, 17, 23],
    '4-5-1_(2)':     [1, ...D4, 11, 13, 14, 15, 16, 23],
    '5-1-2-2':       [1, ...D5, 12, 14, 16, 22, 24],
    '5-2-1-2':       [1, ...D5, 11, 13, 15, 22, 24],
    '5-2-2-1':       [1, ...D5, 11, 13, 14, 16, 23],
    '5-3-2':         [1, ...D5, 12, 14, 16, 22, 24],
    '5-4-1':         [1, ...D5, 11, 13, 14, 16, 20],
};

/** Vagas de um esquema; formação desconhecida (dado antigo) cai no 4-4-2. */
export function formationSlots(formation: string | undefined): number[] {
    return FORMATION_SLOTS[(formation ?? '').trim()] ?? FORMATION_SLOTS['4-4-2'];
}

// ─── Estilos do RPTool → multiplicadores do Vanifoot v2 ───────────────────────
// midfield/attack/defence escalam os setores; drain é a energia extra a cada 7';
// marking é a marcação do original (0 leve, 1 pesada, 2 muito pesada).
// edge: o pedra-papel-tesoura do RPTool continua valendo sobre o meio-campo.
export interface StyleEffect { midfield: number; attack: number; defence: number; drain: number; marking: number }
export const STYLE_EFFECT: Record<string, StyleEffect> = {
    BALANCEADO:    { midfield: 1.00, attack: 1.00, defence: 1.00, drain: 0, marking: 0 },
    POSSE:         { midfield: 1.12, attack: 1.00, defence: 0.95, drain: 0, marking: 0 },
    CONTRA_ATAQUE: { midfield: 0.85, attack: 1.05, defence: 1.25, drain: 0, marking: 0 },
    RETRANCA:      { midfield: 0.90, attack: 0.75, defence: 1.35, drain: 0, marking: 1 },
    PRESSAO:       { midfield: 1.05, attack: 1.30, defence: 0.70, drain: 1, marking: 2 },
};

export function tacticalEdge(mine: string, enemy: string): number {
    if (mine === 'POSSE'         && enemy === 'RETRANCA')      return 1.15;
    if (mine === 'PRESSAO'       && enemy === 'POSSE')         return 1.15;
    if (mine === 'RETRANCA'      && enemy === 'CONTRA_ATAQUE') return 1.20;
    if (mine === 'CONTRA_ATAQUE' && enemy === 'PRESSAO')       return 1.20;
    if (mine === 'POSSE'         && enemy === 'PRESSAO')       return 0.85;
    if (mine === 'RETRANCA'      && enemy === 'POSSE')         return 0.85;
    return 1.0;
}

// ─── Características do Brasfoot (SKILLS) ─────────────────────────────────────
// 0 Colocação, 1 Defesa Pênalti, 2 Reflexo, 3 Saída Gol, 4 Armação, 5 Cabeceio, 6 Cruzamento,
// 7 Desarme, 8 Drible, 9 Finalização, 10 Marcação, 11 Passe, 12 Resistência, 13 Velocidade.
// O RPTool tem arquétipos; cada um vira as duas características que mais o descrevem.
export const ARCHETYPE_SKILLS: Record<string, number[]> = {
    Muralha:    [0, 3],
    Reflexo:    [2, 1],
    Xerife:     [10, 5],
    Construtor: [11, 7],
    Lateral_Of: [6, 13],
    Trator:     [7, 12],
    Caixeiro:   [12, 11],
    Maestro:    [4, 11],
    Velocista:  [13, 8],
    Dribblador: [8, 13],
    Matador:    [9, 5],
    'Pivô':     [5, 9],
    Coringa:    [11, 8],
};
/** Balanceado: só a característica típica do setor. */
export const SECTOR_SKILL: Record<Sector, number> = { GK: 0, DEF: 10, MID: 11, ATK: 9 };

// ─── Incidentes por minuto: I.a(I, half, minute) ──────────────────────────────
export const INCIDENTS = {
    // por faixa de minuto (<15, <30, resto), 1º / 2º tempo: "1 em N" por minuto
    yellow: [[70, 40, 30], [45, 40, 30]],
    red:    [[1200, 900, 800], [800, 700, 550]],
    injury: [[1500, 1000, 800], [800, 600, 600]],
    /** Marcação (leve, pesada, muito pesada) deixa o amarelo mais provável... */
    markingYellow: [30, 10, 0],
    /** ...e soma ao meio-campo (c.b.ez). */
    markingMidfield: [0, 0.04, 0.08],
};

/** Faixas de vagas para sortear quem leva cartão / se machuca (aq.sS). */
const PICK_RANGES: [number, number][] = [[10, 13], [14, 17], [3, 8], [2, 3], [8, 9], [19, 24], [1, 1]];
export interface PickTable { n: number; zero: number; bands: [number, number][]; rest: number }
export const YELLOW_PICK: PickTable = { n: 100, zero: -1, bands: [[25, 0], [40, 1], [65, 2], [73, 3], [82, 4], [85, 6]], rest: 5 };
export const RED_PICK:    PickTable = { n: 200, zero: 6,  bands: [[80, 0], [110, 1], [160, 2], [170, 3], [190, 4]], rest: 5 };
export const INJURY_PICK: PickTable = { n: 500, zero: 6,  bands: [[150, 0], [250, 1], [320, 2], [360, 3], [420, 4]], rest: 5 };

export function pickRange(t: PickTable, rng: { int(n: number): number }): [number, number] {
    const r = rng.int(t.n);
    if (t.zero >= 0 && r === 0) return PICK_RANGES[t.zero];
    const band = t.bands.find(([upTo]) => r < upTo);
    return PICK_RANGES[band ? band[1] : t.rest];
}

/** f_0.fq(): energia perdida a cada 7 minutos em campo. */
export const energyDrain = (age: number) => (age <= 20 ? 1 : age <= 25 ? 2 : age <= 31 ? 3 : age <= 36 ? 4 : 5);

// ─── Pesos por vaga: quem chuta, quem dá o passe, quem faz contra (c.b.Tx, Ty, Tz) ───
export const SHOOT_W    = [-1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 4, 4, 4, 8, 8, 8, 8, 22, 22, 22, 22, 22, 22, 22, 22];
export const ASSIST_W   = [1, 1, 10, 2, 2, 2, 2, 2, 2, 10, 10, 4, 4, 4, 20, 20, 20, 10, 10, 10, 10, 10, 10, 10, 10, 10];
export const OWN_GOAL_W = [-1, 1, 5, 18, 18, 18, 18, 18, 18, 5, 1, 5, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

// ─── Habilidade individual (development.ts) ───────────────────────────────────
// Sete atributos: Goleiro, Velocidade, Técnica, Passe, Desarme, Armação, Finalização.
/** c.b.B() com habilidade individual: a nota do jogador numa vaga (antes do /10). */
export function individualRating(slot: number, a: number[]): number {
    const [gk, vel, tec, pas, des, arm, fin] = a;
    const w = (v: number, k: number) => Math.round(v * k);
    if (slot === 1) return w(gk, 0.6) + w(tec, 0.15) + w(vel, 0.15) + w(pas, 0.1);
    if (slot >= 3 && slot <= 8) return w(des, 0.5) + w(tec, 0.1) + w(vel, 0.25) + w(pas, 0.1) + w(arm, 0.05);
    if (slot === 2 || slot === 9) return w(des, 0.4) + w(vel, 0.1) + w(tec, 0.1) + w(pas, 0.3) + w(arm, 0.05) + w(fin, 0.05);
    if (slot >= 11 && slot <= 13) return w(des, 0.4) + w(vel, 0.15) + w(tec, 0.1) + w(pas, 0.2) + w(arm, 0.1) + w(fin, 0.05);
    if (slot >= 14 && slot <= 16) return w(des, 0.05) + w(vel, 0.1) + w(tec, 0.1) + w(pas, 0.25) + w(arm, 0.4) + w(fin, 0.1);
    if (slot === 10 || slot === 17) return w(des, 0.05) + w(vel, 0.25) + w(tec, 0.15) + w(pas, 0.25) + w(arm, 0.2) + w(fin, 0.1);
    if (slot >= 19 && slot <= 24) return w(vel, 0.25) + w(tec, 0.25) + w(pas, 0.05) + w(arm, 0.05) + w(fin, 0.4);
    if (slot === 18 || slot === 25) return w(vel, 0.25) + w(tec, 0.15) + w(pas, 0.15) + w(arm, 0.05) + w(fin, 0.4);
    return 0;
}
