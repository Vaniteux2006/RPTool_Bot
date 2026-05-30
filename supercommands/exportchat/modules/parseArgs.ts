// RPTool/supercommands/exportchat/modules/parseArgs.ts
// ─── Parsing de argumentos do comando ────────────────────────────────────────

import { Guild, TextChannel } from 'discord.js';

export interface TimeRange {
    start: Date;
    end:   Date;
}

// ─── Snowflake ────────────────────────────────────────────────────────────────
export function dateToSnowflake(date: Date): string {
    const DISCORD_EPOCH = 1420070400000n;
    return ((BigInt(date.getTime()) - DISCORD_EPOCH) << 22n).toString();
}

// ─── Canal ────────────────────────────────────────────────────────────────────
export function parseChannel(args: string[], guild: Guild): TextChannel | null {
    if (!args.length) return null;
    const id = args[0].replace(/\D/g, '');
    const ch = guild.channels.cache.get(id);
    return ch?.isTextBased() && !ch.isDMBased() ? ch as TextChannel : null;
}

// ─── Intervalo de datas ───────────────────────────────────────────────────────
export function parseTimeRange(raw: string): TimeRange | null {
    const arrowIdx = raw.indexOf('->');
    if (arrowIdx === -1) return null;

    const leftStr  = raw.slice(0, arrowIdx).trim();
    const rightStr = raw.slice(arrowIdx + 2).trim();

    const parseOne = (s: string, isEnd: boolean): Date | null => {
        const now = new Date();

        // HH:MM DD/MM/AAAA
        let m = s.match(/^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (m) {
            const year = m[5].length === 2 ? 2000 + +m[5] : +m[5];
            return new Date(year, +m[4] - 1, +m[3], +m[1], +m[2], 0, 0);
        }
        // DD/MM/AAAA
        m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (m) {
            const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
            return new Date(year, +m[2] - 1, +m[1],
                isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, 0);
        }
        // HH:MM
        m = s.match(/^(\d{1,2}):(\d{2})$/);
        if (m) {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate(),
                +m[1], +m[2], 0, 0);
        }
        return null;
    };

    const start = parseOne(leftStr, false);
    const end   = parseOne(rightStr, true);
    if (!start || !end) return null;

    // Intervalo só de hora (sem data) que passa da meia-noite
    if (end <= start && !leftStr.includes('/') && !rightStr.includes('/')) {
        end.setDate(end.getDate() + 1);
    }
    if (end <= start) return null;

    return { start, end };
}

// ─── Fila de dias ─────────────────────────────────────────────────────────────
export interface DaySegment {
    key:   string; // YYYYMMDD — ordena cronologicamente por sort lexicográfico
    start: Date;
    end:   Date;
}

export function buildDayQueue(start: Date, end: Date): DaySegment[] {
    const days: DaySegment[] = [];
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);

    const endDay = new Date(end);
    endDay.setHours(23, 59, 59, 999);

    while (cur <= endDay) {
        const dayStart = new Date(cur);
        const dayEnd   = new Date(cur);
        dayEnd.setHours(23, 59, 59, 999);

        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');

        days.push({ key: `${y}${m}${d}`, start: dayStart, end: dayEnd });
        cur.setDate(cur.getDate() + 1);
    }

    return days;
}
