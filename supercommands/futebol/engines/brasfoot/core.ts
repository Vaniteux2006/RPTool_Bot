// RPTool/supercommands/futebol/engines/brasfoot/core.ts
// Motor da partida do Vanifoot (src/engine/match.ts), portado do Brasfoot: c.b (duelos de posse,
// lance a lance) e best.I (incidentes por minuto, energia, trocas da IA, notas). Puro: sem Discord nem Mongo.
//
// Adaptações ao RPTool:
//  - posições são setores (GK/DEF/MID/ATK); a vaga só pede o setor;
//  - não há reputação, país nem tipo de competição: a nota do jogador não leva o "peso da competição"
//    e o freio de goleada não olha reputação; a divisão do Δ é sempre ÷8 (sem temporadas);
//  - os dois lados são da IA (trocas automáticas); o dono mexe no intervalo pelo modo IRL;
//  - o ataque soma as vagas 18–25 (o original pula a 18, que nenhum esquema dele usava sozinho).
import { Rng } from './rng';
import {
    type Sector, type StyleEffect, sectorOf, outOfPosition, energyDrain, individualRating,
    INCIDENTS, YELLOW_PICK, RED_PICK, INJURY_PICK, type PickTable, pickRange,
    SHOOT_W, ASSIST_W, OWN_GOAL_W,
} from './tables';

export interface EnginePlayer {
    id:         string;
    name:       string;
    pos:        Sector;
    age:        number;
    /** Força 1–100 (o OVR efetivo do RPTool). */
    strength:   number;
    /** Os sete atributos (Gol, Vel, Téc, Pas, Des, Arm, Fin), quando o jogador tem stats customizados. */
    attrs?:     number[];
    /** Características do Brasfoot (ver tables.ARCHETYPE_SKILLS). */
    skills:     number[];
    star:       boolean;
    worldClass: boolean;
    /** Energia 0–100 ao entrar em campo. */
    energy:     number;
}

export interface Slot { player: EnginePlayer; slot: number }

export interface Side {
    lineup: Slot[];
    bench:  EnginePlayer[];
    style:  StyleEffect;
    /** Vantagem tática (pedra-papel-tesoura do RPTool) sobre o meio-campo. */
    edge:   number;
}

export type EventType = 'goal' | 'yellow' | 'red' | 'injury' | 'sub';
export type GoalKind  = 'normal' | 'penalty' | 'freekick' | 'own' | 'olympic';

export interface MatchEvent {
    minute: number;
    half:   1 | 2;
    side:   0 | 1;
    type:   EventType;
    /** Autor do gol, jogador punido/machucado, ou quem entra. */
    player: string;
    /** Assistência nos gols; quem sai nas trocas. */
    other?: string;
    kind?:  GoalKind;
    secondYellow?: boolean;
}

export interface MatchStats {
    possession: [number, number];
    shots:      [number, number];
    onTarget:   [number, number];
    offTarget:  [number, number];
    tackles:    [number, number];
    passErrors: [number, number];
}

export interface LiveMatch {
    /** Minuto do relógio; `halfTime` logo após o 1º tempo, `over` no apito final. */
    clock(): { minute: number; half: 1 | 2; halfTime: boolean; over: boolean };
    /** Joga um minuto. */
    step(): void;
    goals:  [number, number];
    events: MatchEvent[];
    stats(): MatchStats;
    onPitch(side: 0 | 1): Slot[];
    bench(side: 0 | 1): EnginePlayer[];
    subsLeft(side: 0 | 1): number;
    /** A troca do técnico: `inId` do banco no lugar de `outId`. Retorna o erro, ou null. */
    substitute(side: 0 | 1, outId: string, inId: string): string | null;
    /** Quem jogou, por lado (titulares e quem entrou). */
    played(side: 0 | 1): string[];
    /** Notas 0–10 no apito final (f_0.a); 0 = pouco tempo em campo para ser avaliado. */
    ratings(): Record<string, number>;
}

const MAX_SUBS      = 5;
const MIDFIELD_BASE = [55, 45];
const ATTACK_BASE   = [50, 50];
const SHOT_BASE     = { normal: [5.5, 35.55, 15], three: [4.5, 40.55, 15], five: [3, 40.55, 15], six: [0.5, 40.55, 15] };
const SECTOR_ORDER: Record<Sector, number> = { GK: 0, DEF: 1, MID: 2, ATK: 3 };
/** aq.sH: setores tentados, em ordem, quando falta gente no setor da vaga. */
const SECTOR_TRY: Record<Sector, Sector[]> = {
    GK:  ['GK', 'DEF', 'MID', 'ATK'],
    DEF: ['DEF', 'MID', 'ATK', 'GK'],
    MID: ['MID', 'DEF', 'ATK', 'GK'],
    ATK: ['ATK', 'MID', 'DEF', 'GK'],
};

/** f_0.fG para meias: 0 = volante (Desarme/Marcação), 1 = de criação. */
function midKind(p: EnginePlayer): number {
    const [a, b] = p.skills;
    for (const k of [a, b]) {
        if (k === 11 || k === 9 || k === 8 || k === 4) return 1;
        if (k === 7 || k === 10) return 0;
    }
    return 1;
}

/** ah.a(bench, slot): o primeiro do banco que serve à vaga, relaxando para o setor seguinte (por força). */
export function benchPick(bench: EnginePlayer[], slot: number): EnginePlayer | null {
    for (const sector of SECTOR_TRY[sectorOf(slot)]) {
        const cands = bench.filter(p => p.pos === sector).sort((a, b) => b.strength - a.strength || b.energy - a.energy);
        if (cands.length) return cands[0];
    }
    return null;
}

/** bz.cR: cada vaga do esquema, em ordem, pega o melhor disponível que serve a ela. */
export function autoLineup(players: EnginePlayer[], slots: number[]): { lineup: Slot[]; bench: EnginePlayer[] } {
    const pool = [...players];
    const lineup: Slot[] = [];
    // Primeiro quem é do setor, para que ninguém seja puxado de outro setor antes da hora.
    const pending: number[] = [];
    for (const slot of slots) {
        const own = pool.filter(p => p.pos === sectorOf(slot)).sort((a, b) => fitFor(b, slot) - fitFor(a, slot));
        if (own.length) {
            lineup.push({ player: own[0], slot });
            pool.splice(pool.indexOf(own[0]), 1);
        } else pending.push(slot);
    }
    for (const slot of pending) {
        const p = benchPick(pool, slot);
        if (!p) continue;
        lineup.push({ player: p, slot });
        pool.splice(pool.indexOf(p), 1);
    }
    lineup.sort((a, b) => a.slot - b.slot);
    return { lineup, bench: pool };
}

/** Quem rende mais na vaga: pelos atributos quando existem; senão pela força, com um toque das características. */
function fitFor(p: EnginePlayer, slot: number): number {
    if (p.attrs) return individualRating(slot, p.attrs);
    const sk = p.skills;
    let bonus = 0;
    if ((slot === 2 || slot === 9) && (sk.includes(6) || sk.includes(13))) bonus = 3;
    if ((slot === 10 || slot === 17 || slot === 18 || slot === 25) && (sk.includes(13) || sk.includes(8) || sk.includes(6))) bonus = 3;
    if (slot >= 11 && slot <= 13 && (sk.includes(7) || sk.includes(10))) bonus = 3;
    if (slot >= 14 && slot <= 16 && (sk.includes(4) || sk.includes(11))) bonus = 3;
    if (slot >= 19 && slot <= 24 && (sk.includes(9) || sk.includes(5))) bonus = 3;
    return p.strength + bonus;
}

interface Live {
    side:         Side;
    lineup:       Slot[];
    bench:        EnginePlayer[];
    subs:         number;
    matchYellows: Map<string, number>;
    played:       Set<string>;
    /** I.gn: minutos do 2º tempo em que a IA, perdendo (ou empatando em casa), mexe. */
    behindChecks: number[];
    /** I.gm: minutos do 2º tempo em que ela tira um cansado. */
    tiredChecks:  number[];
    cameOn:       Set<string>;
}

export function liveMatch(home: Side, away: Side, rng: Rng, opts: { neutral?: boolean } = {}): LiveMatch {
    const sides = [home, away];
    const L: Live[] = sides.map(s => ({
        side: s,
        lineup: s.lineup.map(x => ({ ...x })),
        bench: [...s.bench],
        subs: 0,
        matchYellows: new Map(),
        played: new Set(s.lineup.map(x => x.player.id)),
        behindChecks: [],
        tiredChecks: [],
        cameOn: new Set(),
    }));
    // I.hb: os minutos das trocas da IA, sorteados para a partida.
    {
        const gs = rng.shuffle(Array.from({ length: 20 }, (_, i) => 19 + i));
        L[0].behindChecks = [gs[0], gs[1]];
        L[1].behindChecks = [gs[2], gs[3]];
        const n3 = rng.int(100);
        if (rng.int(100) > 30) L[0].behindChecks.push(gs[4]);
        if (rng.int(100) > 30) L[1].behindChecks.push(gs[5]);
        const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
        const pool = rng.shuffle(n3 > 90 ? range(5, 15) : n3 > 50 ? range(16, 35) : range(36, 42));
        L[0].tiredChecks = [pool[0], pool[1]];
        L[1].tiredChecks = [pool[2], pool[3]];
        const gw = rng.shuffle(range(43, 47));
        if (rng.int(100) > 20) L[0].tiredChecks.push(gw[0]);
        if (rng.int(100) > 50) L[0].tiredChecks.push(gw[1]);
        if (rng.int(100) > 20) L[1].tiredChecks.push(gw[2]);
        if (rng.int(100) > 50) L[1].tiredChecks.push(gw[3]);
    }
    const everyone = new Map<string, EnginePlayer>();
    for (const s of sides) for (const p of [...s.lineup.map(x => x.player), ...s.bench]) everyone.set(p.id, p);
    const energy = new Map<string, number>();
    const en = (p: EnginePlayer) => energy.get(p.id) ?? p.energy;
    const neutral = !!opts.neutral;
    const goals:  [number, number] = [0, 0];
    const shots:  [number, number] = [0, 0];
    const events: MatchEvent[] = [];
    // Estatísticas (best.I hY/hZ/ia/hB/hC): os cara-ou-coroa delas usam um fluxo próprio, para não mexer no placar.
    const statRng    = new Rng((rng.state ^ 0x5bd1e995) >>> 0);
    const duels:      [number, number] = [0, 0];
    const onTarget:   [number, number] = [0, 0];
    const offTarget:  [number, number] = [0, 0];
    const tackles:    [number, number] = [0, 0];
    const passErrors: [number, number] = [0, 0];
    /** components.s_0: por jogador, gols (contados como o original), contras e chutes no gol. */
    const tally = new Map<string, { goals: number; own: number; onTarget: number }>();
    const tallyOf = (id: string) => {
        let t = tally.get(id);
        if (!t) tally.set(id, (t = { goals: 0, own: 0, onTarget: 0 }));
        return t;
    };
    /** A vaga em que cada um terminou (quem saiu fica com a que deixou). */
    const lastSlot = new Map<string, number>();
    for (const s of sides) for (const x of s.lineup) lastSlot.set(x.player.id, x.slot);
    let yellowsInMatch = 0;
    let redsInMatch = 0;
    let injuriesInMatch = 0;
    let att: 0 | 1 = rng.next() < 0.5 ? 0 : 1;

    // c.b.B(): a nota do jogador para esta partida.
    const rating = (s: Slot): number => {
        const p = s.player;
        let n = p.attrs ? individualRating(s.slot, p.attrs) : p.strength;
        if (outOfPosition(s.slot, p.pos)) n = Math.round(n * 0.5);
        if (n <= 0) n = 1;
        return n / 10;
    };

    const inSlots = (i: 0 | 1, lo: number, hi: number) => L[i].lineup.filter(s => s.slot >= lo && s.slot <= hi);
    const sum = (xs: Slot[]) => xs.reduce((a, s) => a + rating(s), 0);
    const style = (i: 0 | 1) => sides[i].style;
    // Menos de 3 no meio ou na defesa: o setor vale 0,01. O RPTool tem esquema com 2 meias (4-2-4),
    // que nenhum do original tinha; para ele o mínimo é o que o esquema escalou.
    const minMid = L.map(l => Math.max(1, Math.min(3, l.lineup.filter(s => s.slot >= 10 && s.slot <= 17).length)));
    // c.b.ez / eA / eE / eB
    const midfield = (i: 0 | 1) => {
        const ps = inSlots(i, 10, 17).slice(0, 5);
        if (ps.length < minMid[i]) return 0.01;
        return ((INCIDENTS.markingMidfield[style(i).marking] + sum(ps)) / 5) * style(i).midfield * sides[i].edge;
    };
    const attack = (i: 0 | 1) => {
        const ps = inSlots(i, 18, 25).slice(0, 3);
        return ps.length < 1 ? 0 : (sum(ps) / 3) * style(i).attack;
    };
    const defence = (i: 0 | 1) => {
        const ps = inSlots(i, 2, 9).slice(0, 5);
        return ps.length < 3 ? 0.01 : (sum(ps) / 5) * style(i).defence;
    };
    const keeper = (i: 0 | 1) => {
        const gk = L[i].lineup.find(s => s.slot === 1);
        if (!gk) return 0.1;
        const r = rating(gk);
        return outOfPosition(1, gk.player.pos) ? Math.round(r * 0.2) : r;
    };
    const tilt = (x: number, y: number) => (x - y) / 8;

    const weightedSlot = (i: 0 | 1, weight: (s: Slot) => number, exclude?: string): Slot | undefined => {
        const cands = L[i].lineup.filter(s => s.player.id !== exclude);
        const ws = cands.map(s => Math.max(0, weight(s)));
        if (!ws.some(w => w > 0)) return cands[cands.length - 1];
        return cands[rng.weighted(ws)];
    };

    // c.b.vU: quem chuta.
    const shooter = (i: 0 | 1) =>
        weightedSlot(i, s => {
            if (s.slot === 1 || s.player.pos === 'GK') return 0;
            let w = SHOOT_W[s.slot] ?? 0;
            const sk = s.player.skills;
            if (sk.includes(9)) w += 4;
            else if (sk.includes(5)) w += 2 + (s.player.pos === 'DEF' ? 2 : 0);
            return w;
        });

    // c.b.C: quem dá o passe (20% dos gols não têm).
    const assister = (i: 0 | 1, scorer: string) => {
        if (rng.int(100) > 80) return undefined;
        const fullBack = (s: Slot) => s.slot === 2 || s.slot === 9 || s.slot === 10 || s.slot === 17;
        return weightedSlot(i, s => {
            let w = ASSIST_W[s.slot] ?? 0;
            const [c1, c2] = s.player.skills;
            const has = (k: number) => c1 === k || c2 === k;
            if (has(11)) w += 10 + (has(4) ? 5 : 0);
            else if (has(4)) w += 2 + (c1 === 8 ? 2 : 0);
            else if (has(8)) w += 2 + (c1 === 13 ? 2 : 0);
            else if (has(13)) w += 2 + (fullBack(s) ? 2 : 0);
            else if (has(6)) w += 5 + (fullBack(s) ? 2 : 0);
            if (style(i).marking === 1 && fullBack(s)) w += 20;
            return w;
        }, scorer);
    };

    const half = (minute: number): 1 | 2 => (minute > 45 ? 2 : 1);

    const removeFromPitch = (i: 0 | 1, id: string): Slot | null => {
        const idx = L[i].lineup.findIndex(s => s.player.id === id);
        if (idx === -1) return null;
        lastSlot.set(id, L[i].lineup[idx].slot);
        return L[i].lineup.splice(idx, 1)[0];
    };

    /** I.a(side, ...): o reserva da vaga entra; com keeperRule, goleiro só por goleiro. */
    const autoSub = (i: 0 | 1, outSlot: Slot, minute: number, keepSlot = true, keeperRule = false): boolean => {
        const live = L[i];
        if (live.subs >= MAX_SUBS || !live.bench.length) return false;
        const inc = benchPick(live.bench, outSlot.slot);
        if (!inc) return false;
        if (keeperRule && !(outSlot.player.pos === 'GK' || inc.pos !== 'GK')) return false;
        live.bench.splice(live.bench.indexOf(inc), 1);
        live.cameOn.add(inc.id);
        live.subs++;
        if (!keepSlot) removeFromPitch(i, outSlot.player.id);
        live.lineup.push({ player: inc, slot: outSlot.slot });
        live.played.add(inc.id);
        events.push({ minute, half: half(minute), side: i, type: 'sub', player: inc.id, other: outSlot.player.id });
        return true;
    };

    const pick = (i: 0 | 1, table: PickTable) => {
        const [lo, hi] = pickRange(table, rng);
        const cands = inSlots(i, lo, hi);
        return cands.length ? cands[rng.int(cands.length)] : undefined;
    };

    const sendOff = (i: 0 | 1, s: Slot, minute: number, secondYellow: boolean) => {
        events.push({ minute, half: half(minute), side: i, type: 'red', player: s.player.id, secondYellow: secondYellow || undefined });
        removeFromPitch(i, s.player.id);
        // I.a(n6, true, ...): a IA repõe um defensor ou meia expulso, tirando um atacante (ou um meia).
        if (s.slot <= 13 && L[i].subs < MAX_SUBS) {
            const any = (lo: number, hi: number) => {
                const c = inSlots(i, lo, hi);
                return c.length ? rng.shuffle([...c])[0] : undefined;
            };
            const off = any(18, 25) ?? any(14, 17) ?? (s.slot === 1 ? any(2, 25) : undefined);
            if (off && autoSub(i, { player: off.player, slot: s.slot }, minute, true)) removeFromPitch(i, off.player.id);
        }
    };

    // best.I.a(I, half, minute)
    const incidents = (minute: number, rel: number, h: 1 | 2) => {
        const i: 0 | 1 = rng.int(100) > 55 ? 0 : 1;
        const band = rel < 15 ? 0 : rel < 30 ? 1 : 2;
        const hi = h === 1 ? 0 : 1;
        let yellowN = INCIDENTS.yellow[hi][band] + INCIDENTS.markingYellow[style(i).marking];
        const redN = INCIDENTS.red[hi][band];
        const injN = INCIDENTS.injury[hi][band];
        if (yellowsInMatch > 5) yellowN *= 2;
        if (redsInMatch >= 2) yellowN = redN * 2;
        if (injuriesInMatch >= 1) yellowN = injN * 5;
        if (rng.int(yellowN) === 1) {
            yellowsInMatch++;
            const s = pick(i, YELLOW_PICK);
            if (!s) return;
            const n = (L[i].matchYellows.get(s.player.id) ?? 0) + 1;
            L[i].matchYellows.set(s.player.id, n);
            if (n === 2) sendOff(i, s, minute, true);
            else events.push({ minute, half: h, side: i, type: 'yellow', player: s.player.id });
        } else if (rng.int(redN) === 1) {
            const s = pick(i, RED_PICK);
            if (s) sendOff(i, s, minute, false);
            redsInMatch++;
        } else if (rng.int(injN) === 1) {
            injuriesInMatch++;
            const s = pick(i, INJURY_PICK);
            if (!s) return;
            events.push({ minute, half: h, side: i, type: 'injury', player: s.player.id });
            // I.a(5, ...): o machucado sai e entra o reserva da vaga.
            removeFromPitch(i, s.player.id);
            autoSub(i, s, minute, true, true);
        } else if (h === 2 && rel >= 5) {
            computerSubs(minute, rel);
        }
    };

    // I.a(type, ...): 1 tira o primeiro cansado de linha; 2 um de linha qualquer que não acabou de entrar.
    const computerChange = (i: 0 | 1, kind: 1 | 2, minute: number, rel: number): boolean => {
        const live = L[i];
        if (kind === 1) {
            const limit = rel > 40 ? 90 : 60;
            const start = rel > 40 && live.lineup.length > 0 ? rng.int(live.lineup.length) : 0;
            const tired = live.lineup.slice(start).find(s => s.slot !== 1 && en(s.player) < limit);
            return !!tired && autoSub(i, tired, minute, false);
        }
        if (!live.lineup.length) return false;
        let p = live.lineup[rng.int(live.lineup.length)];
        if (live.cameOn.has(p.player.id)) p = live.lineup[rng.int(live.lineup.length)];
        if (p.slot === 1 || live.cameOn.has(p.player.id)) return false;
        return autoSub(i, p, minute, false);
    };

    // I.m: no 2º tempo a IA mexe nos minutos sorteados: perdendo (ou empatando em casa), ou com cansados.
    const computerSubs = (minute: number, rel: number) => {
        let done = false;
        const behind = (i: 0 | 1, by: number) => (i === 0 ? goals[1] - goals[0] >= by : goals[0] - goals[1] >= by);
        if (L[0].subs < MAX_SUBS) {
            if (rel === 0 && behind(0, 1)) {
                if (rng.int(100) > 50) done = computerChange(0, 2, minute, rel);
            } else if (L[0].behindChecks.includes(rel)) {
                if (behind(0, 1) || goals[0] === goals[1]) done = computerChange(0, 2, minute, rel);
            } else if (L[0].tiredChecks.includes(rel)) done = computerChange(0, 1, minute, rel);
        }
        if (!done && L[1].subs < MAX_SUBS) {
            if (rel === 0 && behind(1, 2)) {
                if (rng.int(100) > 50) computerChange(1, 2, minute, rel);
            } else if (L[1].behindChecks.includes(rel)) {
                if (behind(1, 1)) computerChange(1, 2, minute, rel);
            } else if (L[1].tiredChecks.includes(rel)) computerChange(1, 1, minute, rel);
        }
    };

    // best.I.l: a energia cai a cada 7 minutos (goleiros só no 2º tempo).
    const drain = (h: 1 | 2) => {
        L.forEach((live, i) => {
            for (const s of live.lineup) {
                if (s.slot === 1 && h === 1) continue;
                const extra = s.slot === 1 ? 0 : style(i as 0 | 1).drain;
                energy.set(s.player.id, Math.max(1, en(s.player) - energyDrain(s.player.age) - extra));
            }
        });
    };

    // c.b.vT: o chute.
    const shot = (minute: number, h: 1 | 2) => {
        const def = (1 - att) as 0 | 1;
        const D = defence(def);
        const A = attack(att);
        const taker = shooter(att);
        const S = taker ? rating(taker) : 0.1;
        const G = keeper(def);
        let save = 1 + tilt(G, S);
        let wide = 1 + tilt(D, A);
        if (!neutral) {
            if (att === 0) { save += 0.1; wide = save + 0.1; }
            else           { save -= 0.1; wide = save - 0.1; }
        }
        // Freio de goleada: a partir do 3º gol, o peso do gol cai.
        const scored = goals[att];
        const base = scored >= 6 ? SHOT_BASE.six : scored >= 5 ? SHOT_BASE.five : scored >= 3 ? SHOT_BASE.three : SHOT_BASE.normal;
        save = Math.max(0.2, save);
        wide = Math.max(0.2, wide);
        shots[att]++;
        const outcome = rng.weighted([base[0], base[1] * save, base[2] * wide]);
        if (outcome === 2) offTarget[att]++;
        else onTarget[att]++;
        if (outcome === 1 && taker) tallyOf(taker.player.id).onTarget++;
        if (outcome !== 0) return;
        scoreGoal(minute, h, taker);
    };

    // c.b.a(a_0, f_0): que tipo de gol, e de quem.
    const scoreGoal = (minute: number, h: 1 | 2, taker: Slot | undefined) => {
        const r = rng.int(1000);
        let kind: GoalKind = r < 900 ? 'normal' : r < 950 ? 'penalty' : r < 980 ? 'freekick' : r < 990 ? 'own' : r < 995 ? 'olympic' : 'normal';
        let scorer = taker?.player.id;
        if (kind === 'own') {
            const og = weightedSlot((1 - att) as 0 | 1, s => OWN_GOAL_W[s.slot] ?? 0);
            if (og) scorer = og.player.id;
            else kind = 'normal';
        } else if (kind === 'olympic' && taker?.player.pos === 'GK') kind = 'normal';
        if (!scorer) return;
        goals[att]++;
        if (kind === 'own') {
            tallyOf(scorer).own++;
            if (taker) tallyOf(taker.player.id).goals++;
        } else tallyOf(scorer).goals += 2;
        const assist = kind === 'normal' ? assister(att, scorer) : undefined;
        events.push({ minute, half: h, side: att, type: 'goal', player: scorer, other: assist?.player.id, kind });
    };

    // c.b.vO: um minuto de jogo.
    const minuteOfPlay = (minute: number, rel: number, h: 1 | 2) => {
        incidents(minute, rel, h);
        if (rel % 7 === 0) drain(h);
        const def = (1 - att) as 0 | 1;
        const homeEdge = !neutral && att === 0 ? 0.3 : 0;
        // Duelo no meio-campo (vR)
        const ma = midfield(att);
        const md = midfield(def);
        const wa = Math.max(0.2, 1 + tilt(ma, md) + homeEdge);
        const wd = Math.max(0.2, 1 + tilt(md, ma));
        const won = rng.weighted([MIDFIELD_BASE[0] * wa, MIDFIELD_BASE[1] * wd]);
        duels[won === 0 ? att : def]++;
        const breakdown = () => {
            if (statRng.int(100) < 50) tackles[def]++;
            else passErrors[att]++;
        };
        if (won !== 0) breakdown();
        else {
            // Ataque × defesa (vS)
            const D = defence(def);
            const A = attack(att);
            let ka = 1 + tilt(A, D);
            let kd = 1 + tilt(D, A);
            if (D === 0) kd = 0.1;
            ka += homeEdge;
            if (A === 0) ka = 0.1;
            ka = Math.max(0.2, ka);
            kd = Math.max(0.2, kd);
            if (rng.weighted([ATTACK_BASE[0] * ka, ATTACK_BASE[1] * kd]) === 0) shot(minute, h);
            else breakdown();
        }
        att = def;
    };

    const firstHalf = 45 + rng.int(3);
    let secondHalf  = 0;
    let phase: 1 | 2 | 3 = 1;
    let m = 0;
    let halfTime = false;
    const possession = (): [number, number] => {
        const total = duels[0] + duels[1];
        if (!total) return [50, 50];
        const a = Math.round((duels[0] / total) * 100);
        return [a, 100 - a];
    };
    const clockMinute = () => (phase === 1 ? Math.min(m, 45) : Math.min(45 + m, 90));

    /** f_0.a(at, I, side, ...): a nota do jogador no apito final, com as manias do original. */
    const rate = (p: EnginePlayer, i: 0 | 1, pos: [number, number]): number => {
        const o = (1 - i) as 0 | 1;
        const gf = goals[i];
        const ga = goals[o];
        const result = gf > ga ? 1 : gf < ga ? 2 : 0;
        // Minutos em campo: o original conta cada tempo como 48–50 minutos a partir do minuto da troca.
        let mins = 90;
        for (const e of events) {
            if (e.type !== 'sub' || e.side !== i) continue;
            if (e.other === p.id)  mins = e.minute <= 45 ? e.minute : 48 + (e.minute - 45);
            if (e.player === p.id) mins = e.minute <= 45 ? 98 - e.minute : 95 - e.minute;
        }
        const slot = lastSlot.get(p.id) ?? [1, 6, 13, 23][SECTOR_ORDER[p.pos]];
        const str = p.strength;
        let d =
            result === 0 ? (str <= 30 ? 5.5 : str <= 60 ? 5.8 : str <= 90 ? 6.2 : 6.8)
            : result === 1 ? (str <= 30 ? 6.0 : str <= 60 ? 6.0 : str <= 90 ? 6.7 : 7.2)
            : str <= 30 ? 5.0 : str <= 60 ? 5.2 : str <= 90 ? 5.5 : 6.0;
        if (outOfPosition(slot, p.pos)) {
            d -= 1.5;
            if (slot === 1) d -= 1.5;
        }
        const r = (n: number) => statRng.int(n);
        if (slot >= 10 && slot <= 17) {
            if (pos[i] > pos[o]) {
                d += r(3) === 1 ? 0.3 : 0.8;
                if (midKind(p) === 0) d += 0.3;
                if (p.skills[0] === 11 || p.skills[0] === 4) d += 0.5;
            } else if (pos[i] < pos[o]) {
                d -= r(3) === 1 ? 0.3 : 0.8;
                if (midKind(p) === 0) d -= 0.5;
            }
        }
        const t = tally.get(p.id) ?? { goals: 0, own: 0, onTarget: 0 };
        const mine = events.filter(e => e.player === p.id);
        const yellows = mine.filter(e => e.type === 'yellow').length + mine.filter(e => e.type === 'red' && e.secondYellow).length;
        const reds = mine.filter(e => e.type === 'red').length;
        const assists = events.filter(e => e.type === 'goal' && e.other === p.id).length;
        d += t.goals * 0.9;
        d -= t.own * 1.5;
        d -= yellows * 0.2;
        d -= reds * 0.8;
        d += assists * 0.4;
        if (slot >= 1 && slot <= 13) {
            if (tackles[i] > tackles[o]) {
                d += r(3) === 1 ? 0.9 : 0.6;
                if (slot >= 2 && slot <= 9 && r(3) === 1) d += 0.6;
                if (slot >= 11 && slot <= 13 && r(3) === 1) d += 0.6;
            } else if (tackles[i] < tackles[o]) {
                d -= 0.5;
                if (slot >= 3 && slot <= 8 && r(4) === 1) d -= 0.6;
                if (slot >= 11 && slot <= 13 && r(4) === 1) d -= 0.6;
            }
        }
        d += t.onTarget * 0.3;
        if (slot === 1) {
            d -= 0.8;
            const faced = onTarget[o];
            d += faced * 0.2;
            if (shots[o] > 10) d += 0.2;
            d += ga >= 5 ? -2 : ga >= 4 ? -1.5 : ga >= 2 ? -1 : ga >= 1 ? -0.5 : 1;
            if (faced === 0) d -= 1.5;
        }
        if (slot >= 1 && slot <= 13) {
            if (ga === 0) {
                d += 0.5;
                if (slot >= 2 && slot <= 9) d += 0.5;
                if (slot >= 11 && slot <= 13 && r(3) === 1) d += 0.5;
            } else if (ga > 1) d -= 0.1 * ga;
            if (slot >= 2 && slot <= 13 && r(3) === 1) d -= 0.4;
        }
        if (p.star || p.worldClass) d += 0.4;
        if (p.worldClass) d += 0.6;
        if (d > 10) d = 10;
        if (d < 0) d = 1;
        if (mins < 15) d -= 2.5;
        else if (mins < 45) d -= 1.5;
        if (d < 2) d = 2;
        if (mins < 20 && d <= 2) d = 0;
        return Math.round(d * 10) / 10;
    };

    return {
        goals,
        events,
        stats: () => ({
            possession: possession(),
            shots:      [...shots] as [number, number],
            onTarget:   [...onTarget] as [number, number],
            offTarget:  [...offTarget] as [number, number],
            tackles:    [...tackles] as [number, number],
            passErrors: [...passErrors] as [number, number],
        }),
        clock: () => ({ minute: clockMinute(), half: phase === 1 ? 1 : 2, halfTime, over: phase === 3 }),
        step() {
            halfTime = false;
            if (phase === 1) {
                m++;
                // I.a(this, half, n2): o original conta os minutos de cada tempo a partir de 0.
                minuteOfPlay(Math.min(m, 45), m - 1, 1);
                if (m >= firstHalf) {
                    phase = 2;
                    m = 0;
                    halfTime = true;
                    secondHalf = 45 + rng.int(5) + 1;
                }
            } else if (phase === 2) {
                if (m === 0) computerSubs(46, 0);
                m++;
                minuteOfPlay(Math.min(45 + m, 90), m - 1, 2);
                if (m >= secondHalf) phase = 3;
            }
        },
        onPitch:  i => L[i].lineup,
        bench:    i => L[i].bench,
        subsLeft: i => MAX_SUBS - L[i].subs,
        substitute(i, outId, inId) {
            const live = L[i];
            if (live.subs >= MAX_SUBS) return 'Não há mais substituições.';
            const out = live.lineup.find(x => x.player.id === outId);
            const inc = live.bench.find(p => p.id === inId);
            if (!out || !inc) return 'Jogador indisponível.';
            live.bench.splice(live.bench.indexOf(inc), 1);
            live.subs++;
            removeFromPitch(i, outId);
            live.lineup.push({ player: inc, slot: out.slot });
            live.played.add(inc.id);
            live.cameOn.add(inc.id);
            const minute = clockMinute();
            events.push({ minute, half: half(minute), side: i, type: 'sub', player: inc.id, other: outId });
            return null;
        },
        played: i => [...L[i].played],
        ratings() {
            const pos = possession();
            for (const live of L) for (const x of live.lineup) lastSlot.set(x.player.id, x.slot);
            const out: Record<string, number> = {};
            ([0, 1] as const).forEach(i => {
                for (const id of L[i].played) {
                    const p = everyone.get(id);
                    if (p) out[id] = rate(p, i, pos);
                }
            });
            return out;
        },
    };
}

/** bg_0: disputa de pênaltis cobrança a cobrança, 70% cada, mandante primeiro; cinco cada, depois morte súbita. */
export function shootout(rng: Rng = new Rng()): { home: number; away: number } {
    const goals = [0, 0];
    const taken = [0, 0];
    for (;;) {
        for (const side of [0, 1]) {
            taken[side]++;
            if (rng.int(100) + 1 <= 70) goals[side]++;
            if (taken[0] <= 5 && taken[1] <= 5) {
                if (goals[0] > goals[1] + (5 - taken[1])) return { home: goals[0], away: goals[1] };
                if (goals[1] > goals[0] + (5 - taken[0])) return { home: goals[0], away: goals[1] };
            }
        }
        if (taken[0] >= 5 && taken[1] === taken[0] && goals[0] !== goals[1]) return { home: goals[0], away: goals[1] };
    }
}
