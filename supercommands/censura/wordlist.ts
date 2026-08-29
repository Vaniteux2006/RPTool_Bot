// RPTool/supercommands/censura/wordlist.ts
// ─── Listas padrão de termos censurados (pt-BR + EN) ──────────────────────────
// Base: LDNOOBW enriquecida com abreviações de internet e variações de
// mascaramento (leet, trocas de letra). A comparação é feita pela forma
// NORMALIZADA (sem acento, minúscula, leet desfeito: @→a, 0→o, 3→e...), então
// variações que normalizam igual ("c@ralho" ≡ "caralho") são deduplicadas na
// compilação — mantê-las aqui documenta a intenção e não custa nada.
//
// Variações com '*' no meio (ex: "f*ck") compilam como sequência de tokens
// [f, ck] e casam exatamente quem digita a forma mascarada — por isso valem
// a pena, EXCETO quando a sequência também é frase legítima (ver exclusões).
//
// Removidos da fonte original por gerarem falso positivo grave:
//   pt-BR:
//     "vc"  (abreviação de "você" — estava como variação de "vai se foder")
//     "c*"  (compilaria para a letra "c" sozinha e censuraria qualquer "c" solto)
//   EN (pensando em servidor brasileiro):
//     "bj"  (= beijo!)              "hj"  (= hoje!)
//     "hs"  (= horas, "3 hs")       "ah"  (interjeição universal)
//     "sh"  (shhh de silêncio)      "gd"  ("gd night" = good)
//     "jo"  (apelido/nome)          "ho"  ("ho ho ho" — mantidos hoe/h0e)
//     "b"   (1 letra — rejeitado na compilação de qualquer forma)
//     "a**hole"/"a-hole" (compilam [a, hole] e censurariam "a hole" legítimo)
//     "a*se" (compila [a, se] e censuraria "a se" em português!)
//     "k*ke" (compila [k, ke] e censuraria "k, ke..." do chat informal BR)
//
// A staff pode desativar termos por servidor com `rp!censura remove <termo>`
// (vira disabledWords no CensuraConfig) — útil pra termos ambíguos como
// "rola" (verbo), "pau" (madeira), "coco" (fruta), "cnt" (can't), "dam".

export const PT_TERMS: string[] = [
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

export const EN_TERMS: string[] = [
    // ── fuck ──
    'fuck', 'wtf', 'stfu', 'gtfo', 'fu', 'af', 'mf', 'fk', 'fck',
    'f*ck', 'fuk', 'fuc', 'phuck', 'fvck', 'f u c k', 'fcuk',
    // conjugações comuns (não vinham na fonte, mas são a forma mais usada)
    'fucking', 'fuckin', 'fucked', 'fucks',
    'fucker', 'fucka', 'fvcker', 'f*cker',
    'motherfucker', 'mofo', 'motherf*cker', 'mothafucka', 'muthafucker',
    // ── shit ──
    'shit', 'bs', 'wtsh', 'sh*t', 'sht', 'shyt', 'sh1t', '$hit', 's h i t',
    'bullshit', 'bullsh*t', 'bullsht', 'bull sh1t',
    // ── xingamentos ──
    'bitch', 'biatch', 'biotch', 'b*tch', 'btch', 'b1tch', 'bytch', 'beetch', 'bish',
    'asshole', 'asshat', 'assh0le',
    'ass', 'az', 'a$$', '@ss',
    'dumbass', 'dumba$$', 'dumbazz', 'dumb ass',
    'jackass', 'jacka$$', 'jackazz',
    'prick', 'pr*ck', 'pr1ck',
    'cunt', 'c*nt', 'cnt', 'kunt', 'c u n t',
    'twat', 'tw*t', 'twaat',
    'whore', 'hoe', 'wh*re', 'whor', 'h0e',
    'slut', 'sl*t', 'slutt', '$lut',
    'bastard', 'b*stard', 'bastrd', 'basterd',
    'wanker', 'w*nker', 'wanka',
    'bollocks', 'bollox', 'ballox',
    'arse', 'arsehole',
    'scum', 'sc*m', 'scumbag',
    'douche', 'douchebag', 'd*uche', 'doosh',
    'idiot', 'idi0t', 'idyot',
    'moron', 'mor0n', 'moran',
    'loser', 'l0ser', 'looser',
    'screw you', 'screw u', 'screwyou',
    // ── anatomia/sexual ──
    'dick', 'd*ck', 'dik', 'd1ck', 'dck',
    'dickhead', 'd*ckhead', 'dikhead', 'dick head',
    'cock', 'c*ck', 'cok', 'c0ck', 'kock',
    'pussy', 'p*ssy', 'pussi', 'pu$$y', 'pussay',
    'cum', 'c*m', 'cumming', 'kum',
    'jerk off', 'jerkoff', 'jerk-off', 'jack off', 'jackoff',
    'blowjob', 'blow job', 'bl0wjob',
    'handjob', 'hand job',
    'boobs', 'b00bs', 'boob', 'boobies',
    'tits', 't*ts', 'titties', 't1ts',
    'porn', 'pr0n', 'p0rn', 'pornography',
    'horny', 'h0rny', 'horni',
    // ── discriminatório ──
    'retard', 'tard', 'ret*rd', 'retarded', 'r-word',
    'faggot', 'fag', 'f*ggot', 'fagg0t', 'f@g', 'faggit',
    'dyke', 'dy*e',
    'tranny', 'tr*nny', 'trannie',
    'nigger', 'n-word', 'n*gger', 'n1gger', 'nigga', 'n1gga', 'n!gger',
    'chink', 'ch*nk',
    'spic', 'sp*c',
    'kike',
    'wetback', 'wet back',
    'nazi', 'n*zi', 'naz1',
    // ── escatológico / leves ──
    'piss', 'p*ss', 'pissed', 'pissoff', 'piss off',
    'crap', 'cr*p', 'crappy',
    'damn', 'dmn', 'd*mn', 'dam', 'damnit', 'dammit', 'goddamn',
    'hell', 'wth', 'h*ll', 'hel', 'h3ll',
    'bloody', 'bl**dy',
    'sucks', 'suck', 'sux', 'sucker',
    'freakin', 'freaking', 'friggin', 'frickin',
];

export const DEFAULT_TERMS: string[] = [...PT_TERMS, ...EN_TERMS];
