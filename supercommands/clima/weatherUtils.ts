// RPTool/supercommands/clima/weatherUtils.ts
// Utilitários de clima compartilhados entre /tempo (engine) e /clima (consultas)
import axios from 'axios';

// ─── Tabela WMO completa ──────────────────────────────────────────────────────
export const WMO_TABLE: Record<number, string> = {
    0:  'Céu Limpo ☀️',
    1:  'Poucas Nuvens 🌤️',
    2:  'Parcialmente Nublado ⛅',
    3:  'Nublado ☁️',
    45: 'Nevoeiro 🌫️',
    48: 'Nevoeiro com Geada 🌫️',
    51: 'Garoa Leve 🌦️',
    53: 'Garoa 🌧️',
    55: 'Garoa Intensa 🌧️',
    61: 'Chuva Fraca ☔',
    63: 'Chuva Moderada ☔',
    65: 'Chuva Forte ☔',
    71: 'Neve Fraca 🌨️',
    73: 'Neve Moderada 🌨️',
    75: 'Nevasca ❄️',
    80: 'Pancadas de Chuva 🌦️',
    81: 'Chuva com Trovoada ⛈️',
    82: 'Tempestade Violenta ⛈️',
    95: 'Tempestade ⚡',
    96: 'Tempestade com Granizo ⛈️',
    99: 'Tempestade Severa ⛈️',
};

export const STANDARD_WEATHERS = new Set(Object.values(WMO_TABLE));

// ─── Converte código WMO → texto legível ──────────────────────────────────────
export function wmoToText(code: number): string {
    return WMO_TABLE[code] ?? 'Clima Incerto';
}

// ─── Converte código WMO → emoji isolado ─────────────────────────────────────
export function wmoToEmoji(code: number): string {
    if (code === 0)              return '☀️';
    if (code <= 3)               return '⛅';
    if (code <= 48)              return '🌫️';
    if (code <= 57)              return '🌧️';
    if (code <= 67)              return '☔';
    if (code <= 77)              return '🌨️';
    if (code <= 82)              return '⛈️';
    if (code <= 86)              return '❄️';
    if (code <= 99)              return '⚡';
    return '🌡️';
}

// ─── Geocoding: nome de cidade / coordenada → { lat, lon, name, country } ────
export interface GeoResult {
    lat: number;
    lon: number;
    name: string;
    country: string;
}

export async function getCoords(query: string): Promise<GeoResult | null> {
    // Tenta interpretar como coordenadas diretas (ex: "47.6N 122.3W" ou "-33.87, 151.21")
    const coordRegex = /^(-?[0-9]+[.,]?[0-9]*)\s*([NS])?\s*[,\s]+\s*(-?[0-9]+[.,]?[0-9]*)\s*([WE])?$/i;
    const match = query.trim().match(coordRegex);

    if (match) {
        let lat = parseFloat(match[1].replace(',', '.'));
        let lon = parseFloat(match[3].replace(',', '.'));
        if (match[2]?.toUpperCase() === 'S') lat = -lat;
        if (match[4]?.toUpperCase() === 'W') lon = -lon;
        return { lat, lon, name: `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`, country: 'Coordenadas' };
    }

    // Geocoding via Open-Meteo
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=pt&format=json`;
        const res  = await axios.get(url, { timeout: 8000 });
        if (res.data?.results?.length > 0) {
            const r = res.data.results[0];
            return {
                lat:     r.latitude,
                lon:     r.longitude,
                name:    r.name,
                country: r.country ?? '',
            };
        }
    } catch (e) {
        console.error('[weatherUtils] Erro no Geocoding:', e);
    }
    return null;
}

// ─── Clima atual (tempo real) ─────────────────────────────────────────────────
export interface WeatherInstant {
    temp: number;
    code: number;
}

export async function getWeatherInstant(lat: number, lon: number): Promise<WeatherInstant | null> {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
        const res  = await axios.get(url, { timeout: 8000 });
        return {
            temp: res.data.current.temperature_2m,
            code: res.data.current.weather_code,
        };
    } catch { return null; }
}

// ─── Clima histórico (dado uma data RP) ──────────────────────────────────────
// Para datas anteriores a 1950, usa o ano 2000 como proxy
export interface WeatherHistorical {
    min:  number;
    max:  number;
    code: number;
}

export async function getWeatherHistorical(
    lat:  number,
    lon:  number,
    date: Date,
): Promise<WeatherHistorical | null> {
    try {
        let year = date.getUTCFullYear();
        if (year < 1950) year = 2000;
        if (year > new Date().getUTCFullYear()) year = new Date().getUTCFullYear() - 1;

        const mm      = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd      = String(date.getUTCDate()).padStart(2, '0');
        const dateStr = `${year}-${mm}-${dd}`;

        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
        const res = await axios.get(url, { timeout: 10000 });

        if (!res.data?.daily?.weather_code) return null;
        return {
            min:  res.data.daily.temperature_2m_min[0],
            max:  res.data.daily.temperature_2m_max[0],
            code: res.data.daily.weather_code[0],
        };
    } catch { return null; }
}