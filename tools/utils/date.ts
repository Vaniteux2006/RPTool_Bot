// RPTool/tools/utils/date.ts
// ─── Datas BR e durações — fonte única ───────────────────────────────────────
// Antes havia 6 parses de DD/MM/AAAA com 3 semânticas divergentes (31/02 aceito
// num comando e rejeitado noutro; resumo em fuso local × estatística em UTC).
// Regras daqui: SEMPRE UTC, SEMPRE valida overflow (31/02 → null).

export interface ParseBRDateOpts {
    /** Exige o ano (DD/MM/AAAA). Default: ano atual quando omitido. */
    exigirAno?: boolean;
    /** Aceita hora opcional ("15/03/2025 14:30"). Default: false. */
    comHora?: boolean;
}

/** Parseia "DD/MM[/AAAA][ HH:MM]" em Date UTC. Retorna null se inválida (inclui 31/02). */
export function parseBRDate(input: string, opts: ParseBRDateOpts = {}): Date | null {
    const s = (input || '').trim();
    const re = opts.comHora
        ? /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?$/
        : /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/;
    const m = s.match(re);
    if (!m) return null;

    const day = +m[1], month = +m[2];
    if (!m[3] && opts.exigirAno) return null;
    const year = m[3] ? +m[3] : new Date().getUTCFullYear();
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const hour = opts.comHora && m[4] ? +m[4] : 0;
    const minute = opts.comHora && m[5] ? +m[5] : 0;
    if (hour > 23 || minute > 59) return null;

    const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
    // Valida overflow: 31/02 viraria 03/03 sem esta checagem.
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
    return d;
}

/** Como parseBRDate, mas retorna a chave "YYYY-MM-DD" usada pelo ServerStats. */
export function parseBRDateISO(input: string, opts: ParseBRDateOpts = {}): string | null {
    const d = parseBRDate(input, opts);
    return d ? d.toISOString().split('T')[0] : null;
}

export interface ParseDurationOpts {
    /** Rejeita número sem unidade (em vez de assumir minutos). Default: false. */
    exigirUnidade?: boolean;
}

/**
 * Parseia durações humanas em ms: "10m", "2h", "3d", "1.5h", "10 minutos", "1 semana".
 * Sem unidade assume minutos (a não ser que exigirUnidade). Retorna null se inválida.
 */
export function parseDuration(str: string, opts: ParseDurationOpts = {}): number | null {
    if (!str) return null;
    const units: { [key: string]: number } = {
        's': 1000, 'segundo': 1000, 'segundos': 1000,
        'm': 60000, 'minuto': 60000, 'minutos': 60000,
        'h': 3600000, 'hora': 3600000, 'horas': 3600000,
        'd': 86400000, 'dia': 86400000, 'dias': 86400000,
        'w': 604800000, 'semana': 604800000, 'semanas': 604800000,
        'mês': 2592000000, 'meses': 2592000000,
        'y': 31536000000, 'ano': 31536000000, 'anos': 31536000000,
    };

    const match = str.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (!match) return null;
    const value = parseFloat(match[1].replace(',', '.'));
    const unitStr = match[2].trim().toLowerCase();

    if (!unitStr) return opts.exigirUnidade ? null : value * 60000;

    const multiplier = units[unitStr] || units[unitStr.replace(/s$/, '')];
    return multiplier ? value * multiplier : null;
}
