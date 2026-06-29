// RPTool/supercommands/chess/parse.ts
// ─── Parser de lances multi-notação ───────────────────────────────────────────
//
// Aceita o lance escrito de várias formas e devolve o lance JÁ APLICADO no
// tabuleiro (ou null se nenhuma interpretação for legal):
//
//   • SAN inglês ........ e4, Nf3, Qxd4, Qe4+, exd5, e8=Q, O-O
//   • SAN português ..... De4 (Dama), Cf3 (Cavalo), Td1 (Torre), Rxe4 (Rei), Bg5 (Bispo)
//   • UCI/bruto ......... e2e4, e7e8q
//   • Roque ............. O-O, 0-0, o-o-o
//   • Minúsculas ........ nf3, qd4  (peças sem o uppercase)
//   • Decorações ........ sufixos !, ?, +, # são tolerados
//
// Estratégia: gera uma lista de candidatos do mais padrão pro mais "criativo" e
// tenta cada um no chess.js — como a engine valida legalidade, o primeiro lance
// LEGAL é o pretendido. Isso resolve a ambiguidade EN/PT (ex: "Re4" tenta Torre
// inglesa antes de Rei português) sem chutes frágeis.
import type { Chess, Move } from 'chess.js';

// Letras de peça em português → inglês. 'B' (Bispo) coincide com Bishop, então
// não precisa de tradução. 'R' (Rei) e 'K'/'N' só entram se a leitura inglesa falhar.
const PT_TO_EN: Record<string, string> = {
    C: 'N', // Cavalo  → Knight
    T: 'R', // Torre   → Rook
    D: 'Q', // Dama    → Queen
    R: 'K', // Rei     → King
    // B (Bispo) = B (Bishop): idêntico, sem entrada.
};

function stripDecorations(s: string): string {
    return s.replace(/[+#!?]+$/g, '');
}

// Normaliza roque: 0-0, o-o, O-O-O → forma canônica do chess.js.
function normalizeCastle(s: string): string | null {
    const c = s.replace(/0/g, 'O').replace(/o/g, 'O');
    if (/^O-O-O$/.test(c)) return 'O-O-O';
    if (/^O-O$/.test(c)) return 'O-O';
    return null;
}

// Constrói a lista de candidatos (em ordem de prioridade), sem duplicatas.
function buildCandidates(raw: string): (string | { from: string; to: string; promotion?: string })[] {
    const out: (string | { from: string; to: string; promotion?: string })[] = [];
    const seen = new Set<string>();
    const push = (c: string | { from: string; to: string; promotion?: string }) => {
        const key = typeof c === 'string' ? `s:${c}` : `o:${c.from}${c.to}${c.promotion ?? ''}`;
        if (!seen.has(key)) { seen.add(key); out.push(c); }
    };

    const trimmed = raw.trim();
    if (!trimmed) return out;

    // 1) Roque
    const castle = normalizeCastle(stripDecorations(trimmed));
    if (castle) push(castle);

    // 2) UCI / bruto: e2e4, e7e8q
    const uci = trimmed.toLowerCase().match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
    if (uci) push({ from: uci[1], to: uci[2], promotion: uci[3] });

    // Variantes textuais a tentar como SAN (com e sem decorações)
    const bare = stripDecorations(trimmed);
    const textForms = new Set<string>([trimmed, bare]);

    // 3) Uppercase de uma peça em minúscula no início (nf3 → Nf3). NUNCA mexe em
    //    'b' isolado, que é arquivo de peão (b4, bxc3).
    for (const form of [...textForms]) {
        const m = form.match(/^([nrqkctd])(.*)$/i);
        if (m) {
            const head = m[1].toUpperCase();
            if ('NRQKCTD'.includes(head)) textForms.add(head + m[2]);
        }
    }

    // 4) SAN inglês (prioridade) — tudo que já temos em texto
    for (const f of textForms) push(f);

    // 5) Tradução português → inglês: letra de peça inicial e/ou peça de promoção
    //    depois do '=' (ex: De4 → Qe4, b8=D → b8=Q, e8=C → e8=N).
    for (const f of [...textForms]) {
        let pt = f;
        const first = pt[0];
        if (first && PT_TO_EN[first]) pt = PT_TO_EN[first] + pt.slice(1);
        pt = pt.replace(/=([CTDBR])/, (_, p) => '=' + (PT_TO_EN[p] ?? p));
        if (pt !== f) push(pt);
    }

    return out;
}

// Tenta aplicar o lance no tabuleiro. Retorna o Move aplicado, ou null.
export function applyUserMove(chess: Chess, raw: string): Move | null {
    for (const candidate of buildCandidates(raw)) {
        try {
            const move = chess.move(candidate as any);
            if (move) return move; // já aplicado no tabuleiro
        } catch {
            // candidato ilegal/malformado — tenta o próximo
        }
    }
    return null;
}
