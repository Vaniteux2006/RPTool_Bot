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

// ─── Geocoding: nome de cidade / estado / país / coordenada → GeoResult ──────
// Ordem de resolução (o "padrão" de decidir o que é cidade, estado ou país):
//   1. Coordenadas diretas ("47.6N 122.3W", "-33.87, 151.21")
//   2. Estado brasileiro por nome ou UF ("Acre", "RS") — a API da Open-Meteo
//      não retorna estados, então usamos tabela local (coords da capital)
//   3. "Local, Qualificador" — busca o local e filtra pelo qualificador
//      (estado, UF ou país): "Nova Iorque, Maranhão", "Montenegro, RS"
//   4. Nome livre — primeiro resultado da API (países já vêm ranqueados acima)
export interface GeoResult {
    lat: number;
    lon: number;
    name: string;
    country: string;
    admin1?: string;
}

// Comparações ignoram acentos e caixa ("Maranhao" == "Maranhão")
function norm(s: string): string {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

// Estados brasileiros — coordenadas da capital (referência de clima do estado)
const BR_STATES: { uf: string; name: string; lat: number; lon: number }[] = [
    { uf: 'AC', name: 'Acre',                lat:  -9.9750, lon: -67.8243 },
    { uf: 'AL', name: 'Alagoas',             lat:  -9.6660, lon: -35.7350 },
    { uf: 'AP', name: 'Amapá',               lat:   0.0389, lon: -51.0664 },
    { uf: 'AM', name: 'Amazonas',            lat:  -3.1019, lon: -60.0250 },
    { uf: 'BA', name: 'Bahia',               lat: -12.9711, lon: -38.5108 },
    { uf: 'CE', name: 'Ceará',               lat:  -3.7172, lon: -38.5431 },
    { uf: 'DF', name: 'Distrito Federal',    lat: -15.7797, lon: -47.9297 },
    { uf: 'ES', name: 'Espírito Santo',      lat: -20.3194, lon: -40.3378 },
    { uf: 'GO', name: 'Goiás',               lat: -16.6786, lon: -49.2539 },
    { uf: 'MA', name: 'Maranhão',            lat:  -2.5297, lon: -44.3028 },
    { uf: 'MT', name: 'Mato Grosso',         lat: -15.5961, lon: -56.0967 },
    { uf: 'MS', name: 'Mato Grosso do Sul',  lat: -20.4428, lon: -54.6464 },
    { uf: 'MG', name: 'Minas Gerais',        lat: -19.9208, lon: -43.9378 },
    { uf: 'PA', name: 'Pará',                lat:  -1.4558, lon: -48.5044 },
    { uf: 'PB', name: 'Paraíba',             lat:  -7.1150, lon: -34.8631 },
    { uf: 'PR', name: 'Paraná',              lat: -25.4278, lon: -49.2731 },
    { uf: 'PE', name: 'Pernambuco',          lat:  -8.0539, lon: -34.8811 },
    { uf: 'PI', name: 'Piauí',               lat:  -5.0892, lon: -42.8019 },
    { uf: 'RJ', name: 'Rio de Janeiro',      lat: -22.9064, lon: -43.1822 },
    { uf: 'RN', name: 'Rio Grande do Norte', lat:  -5.7950, lon: -35.2094 },
    { uf: 'RS', name: 'Rio Grande do Sul',   lat: -30.0331, lon: -51.2300 },
    { uf: 'RO', name: 'Rondônia',            lat:  -8.7619, lon: -63.9039 },
    { uf: 'RR', name: 'Roraima',             lat:   2.8197, lon: -60.6733 },
    { uf: 'SC', name: 'Santa Catarina',      lat: -27.5967, lon: -48.5492 },
    { uf: 'SP', name: 'São Paulo',           lat: -23.5475, lon: -46.6361 },
    { uf: 'SE', name: 'Sergipe',             lat: -10.9111, lon: -37.0717 },
    { uf: 'TO', name: 'Tocantins',           lat: -10.1675, lon: -48.3277 },
];

const BR_STATE_LOOKUP = new Map<string, typeof BR_STATES[number]>();
for (const s of BR_STATES) {
    BR_STATE_LOOKUP.set(norm(s.name), s);
    BR_STATE_LOOKUP.set(norm(s.uf), s);
}

// Nome de exibição completo: "Nova Iorque, Maranhão, Brasil" (sem repetições)
export function formatGeoName(g: GeoResult): string {
    const parts = [g.name];
    if (g.admin1  && norm(g.admin1)  !== norm(g.name)) parts.push(g.admin1);
    if (g.country && norm(g.country) !== norm(g.name)) parts.push(g.country);
    return parts.join(', ');
}

interface RawGeo {
    latitude:      number;
    longitude:     number;
    name:          string;
    country?:      string;
    admin1?:       string;
    admin2?:       string;
    feature_code?: string;
}

async function searchGeo(query: string, count: number): Promise<RawGeo[]> {
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${count}&language=pt&format=json`;
        const res  = await axios.get(url, { timeout: 8000 });
        return res.data?.results ?? [];
    } catch (e) {
        console.error('[weatherUtils] Erro no Geocoding:', e);
        return [];
    }
}

function toGeoResult(r: RawGeo): GeoResult {
    // PCL* = país inteiro (a API já devolve o centroide)
    const isCountry = r.feature_code?.startsWith('PCL') ?? false;
    return {
        lat:     r.latitude,
        lon:     r.longitude,
        name:    isCountry ? `${r.name} (país)` : r.name,
        country: isCountry ? '' : (r.country ?? ''),
        admin1:  isCountry ? '' : (r.admin1  ?? ''),
    };
}

export async function getCoords(query: string): Promise<GeoResult | null> {
    // 1. Coordenadas diretas — antes da lógica de vírgula, pois "-33.87, 151.21" tem vírgula
    const coordRegex = /^(-?[0-9]+[.,]?[0-9]*)\s*([NS])?\s*[,\s]+\s*(-?[0-9]+[.,]?[0-9]*)\s*([WE])?$/i;
    const match = query.trim().match(coordRegex);

    if (match) {
        let lat = parseFloat(match[1].replace(',', '.'));
        let lon = parseFloat(match[3].replace(',', '.'));
        if (match[2]?.toUpperCase() === 'S') lat = -lat;
        if (match[4]?.toUpperCase() === 'W') lon = -lon;
        return { lat, lon, name: `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`, country: 'Coordenadas' };
    }

    const q = query.trim();

    // 2. Estado brasileiro (nome ou UF)
    const state = BR_STATE_LOOKUP.get(norm(q));
    if (state) {
        return { lat: state.lat, lon: state.lon, name: `${state.name} (estado)`, country: 'Brasil' };
    }

    // 3. "Local, Qualificador" — filtra os resultados pelo estado/UF/país indicado
    const commaIdx = q.indexOf(',');
    if (commaIdx > 0) {
        const place     = q.slice(0, commaIdx).trim();
        let   qualifier = norm(q.slice(commaIdx + 1));
        const qualState = BR_STATE_LOOKUP.get(qualifier);
        if (qualState) qualifier = norm(qualState.name);

        const results = await searchGeo(place, 10);
        const hit = results.find(r =>
            [r.admin1, r.admin2, r.country].some(f => f && norm(f) === qualifier),
        );
        return hit ? toGeoResult(hit) : null;
    }

    // 4. Nome livre — primeiro resultado da API
    const results = await searchGeo(q, 1);
    return results.length > 0 ? toGeoResult(results[0]) : null;
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