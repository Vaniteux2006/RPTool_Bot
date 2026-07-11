// RPTool/supercommands/censura/wordlist.ts
// ─── Lista padrão de termos censurados (pt-BR) ────────────────────────────────
// Base: LDNOOBW enriquecida com abreviações de internet e variações de
// mascaramento (leet, trocas de letra). A comparação é feita pela forma
// NORMALIZADA (sem acento, minúscula, leet desfeito: @→a, 0→o, 3→e...), então
// variações que normalizam igual ("c@ralho" ≡ "caralho") são deduplicadas na
// compilação — mantê-las aqui documenta a intenção e não custa nada.
//
// Removidos da fonte original por gerarem falso positivo grave:
//   "vc"  (abreviação de "você" — estava listada como variação de "vai se foder")
//   "c*"  (compilaria para a letra "c" sozinha e censuraria qualquer "c" solto)
//
// A staff pode desativar termos por servidor com `rp!censura remove <termo>`
// (vira disabledWords no CensuraConfig) — útil pra termos ambíguos como
// "rola" (verbo), "pau" (madeira), "coco" (fruta), "pinto" (ave/sobrenome).

export const DEFAULT_TERMS: string[] = [
    // ── caralho ──
    'caralho', 'krl', 'crl', 'klr', 'caraio', 'carai', 'caralio', 'c@ralho', 'karalho', 'kct',
    'caralhão', 'caralhao', 'karalhao',
    // ── porra ──
    'porra', 'ppr', 'porrra', 'poha', 'porr@', 'p0rra',
    // ── puta que pariu / pqp ──
    'puta que pariu', 'puta q pariu', 'pqp',
    // ── vai se foder / vtnc ──
    'vai se foder', 'vsf', 'vtnc', 'vtmnc', 'vai se fude', 'vai se fuder', 'vaisefoder',
    'vai tomar no cu', 'vai toma no cu', 'vai tomar no rabo',
    // ── foda-se / foder ──
    'foda-se', 'fds', 'fodase', 'foda se',
    'foder', 'fdr', 'fude', 'fuder', 'foda', 'fudido', 'fudida',
    // ── filho da puta ──
    'filho da puta', 'fdp', 'fih da puta', 'filha da puta', 'filhodaputa',
    // ── escatológico ──
    'merda', 'mrd', 'mereda', 'm3rda', 'merd@', 'mrda',
    'bosta', 'b0sta', 'bost@',
    'cagar', 'caga', 'cagado', 'cagão', 'cagou',
    'mijar', 'mija', 'mijo', 'mijado',
    'peidar', 'peido', 'peidão',
    'cocô', 'coco', 'cocozinho',
    // ── anatomia/sexual ──
    'cu', 'cuu', 'cuzao', 'cuzão', 'kuzao', 'cuzões',
    'buceta', 'bct', 'boceta', 'bucet@', 'buc3ta', 'ppk',
    'xoxota', 'chochota', 'xochota', 'xoxot@',
    'pica', 'pika', 'pic@', 'p1ca',
    'pau', 'p@u', 'pauzudo',
    'pinto', 'pint0',
    'pênis', 'penis', 'p3nis',
    'rola', 'rôla', 'rol@',
    // ── sexual ──
    'punheta', 'punhet@', 'bater punheta', 'punheteiro', 'punheteira',
    'gozar', 'gozada', 'goza', 'goz@r',
    'esporra', 'esporrada', 'sporra',
    'transar', 'transa', 'transando',
    'te comer', 'vou te comer', 'te comi',
    'prostituta', 'prostibulo',
    'tarado', 'tarada', 'tar@do',
    'pervertido', 'pervo',
    // ── xingamentos ──
    'puta', 'put@', 'put4', 'putona', 'putaria',
    'vadia', 'vadi@', 'vadya',
    'vagabunda', 'vgb', 'vagaba', 'vagabundo',
    'biscate', 'biscat3',
    'piranha', 'pir@nha',
    'corno', 'corn0', 'cornão', 'cornudo', 'chifrudo',
    'otário', 'otario', 'otár1o', 'otaria', 'otários',
    'babaca', 'bab@ca', 'babakas',
    'idiota', 'idiot@', 'id10ta', 'idiotas',
    'imbecil', 'imbeciw',
    'burro', 'burr0', 'burra', 'jumento',
    'arrombado', 'arrombada', 'arrombad0',
    'desgraçado', 'dsg', 'desgracado', 'desgraça', 'desgraca', 'desgraç@',
    'escroto', 'escrota', 'escrot0',
    'canalha', 'kanalha',
    'safado', 'safada', 'saf@do',
    'seu cachorro', 'sua cachorra', 'aquela cachorra', 'seu cachorrão', 'cachorro sujo', 'vira-lata',
    'cabrão', 'cabrao', 'cabron',
    'cacete', 'cassete', 'kcete', 'cacet3',
    // ── discriminatório ──
    'retardado', 'rtd', 'retardada', 'retard',
    'mongoloide', 'mongol', 'mongolóide',
    'bicha', 'bixa', 'bich@',
    'viado', 'vd', 'veado', 'viadinho',
    'boiola', 'boyola', 'bilola',
    'traveco', 'travecão',
    'sapatão', 'sapatao', 'sapatona',
    'paneleiro',
    'macaco', 'macac0',
    'crioulo', 'criolo',
    // ── leves ──
    'inferno', 'infern0',
    'diabo', 'diabos', 'capeta',
    'caraca', 'karaka',
    'droga', 'drg', 'drog@',
    'que saco', 'saco cheio',
    'palhaço', 'palhaco', 'palhaça',
    'lixo', 'lyxo',
    'nojento', 'nojenta', 'nojeira',
];
