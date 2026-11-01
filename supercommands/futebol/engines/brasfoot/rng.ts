// RPTool/supercommands/futebol/engines/brasfoot/rng.ts
// PRNG com semente (mulberry32), portado do Vanifoot — permite reproduzir uma partida pela semente.
export class Rng {
    private s: number;

    constructor(seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) {
        this.s = seed >>> 0;
    }

    get state(): number {
        return this.s;
    }

    next(): number {
        let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    int(n: number): number {
        return Math.floor(this.next() * n);
    }

    /** Índice sorteado com probabilidade proporcional ao peso. */
    weighted(weights: readonly number[]): number {
        const total = weights.reduce((a, b) => a + b, 0);
        let r = this.next() * total;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r < 0) return i;
        }
        return weights.length - 1;
    }

    shuffle<T>(items: T[]): T[] {
        for (let i = items.length - 1; i > 0; i--) {
            const j = this.int(i + 1);
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
    }
}
