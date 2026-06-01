import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    Message, 
    TextChannel
} from 'discord.js';
import axios from 'axios';
import { mainConnection } from '../tools/database'; 


const WMO_TABLE: {[key: number]: string} = {
    0: "Céu Limpo ☀️",
    1: "Poucas Nuvens 🌤️",
    2: "Parcialmente Nublado ⛅",
    3: "Nublado ☁️",
    45: "Nevoeiro 🌫️",
    51: "Garoa 🌧️",
    61: "Chuva ☔",
    63: "Chuva Moderada ☔",
    71: "Neve 🌨️",
    95: "Tempestade ⚡"
};

const STANDARD_WEATHERS = Object.values(WMO_TABLE);

// Remove emojis para comparação case-insensitive sem emoji
function stripEmojis(str: string) {
    return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}️⃐-⃿]/gu, '').trim();
}

// Tenta casar o input com uma condição padrão WMO (ignorando emojis e case)
function matchStandardWeather(input: string): string | null {
    const norm = stripEmojis(input).toLowerCase();
    return STANDARD_WEATHERS.find(w => stripEmojis(w).toLowerCase() === norm) ?? null;
}


async function getCoords(query: string) {
    if (query.trim().startsWith('<#') || query.trim().startsWith('#')) return null;

    const coordRegex = /^(-?[0-9]+[.,]?[0-9]*)\s*([NS])?\s*[,\s]+\s*(-?[0-9]+[.,]?[0-9]*)\s*([WE])?$/i;
    const match = query.trim().match(coordRegex);

    if (match) {
        let lat = parseFloat(match[1].replace(',', '.'));
        const latDir = match[2]?.toUpperCase();
        let lon = parseFloat(match[3].replace(',', '.'));
        const lonDir = match[4]?.toUpperCase();
        if (latDir === 'S') lat = -lat;
        if (lonDir === 'W') lon = -lon;
        return { lat, lon, name: `📍 ${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: 'Coordenadas' };
    }

    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=pt&format=json`;
        const res = await axios.get(url);
        if (res.data.results && res.data.results.length > 0) {
            return {
                lat: res.data.results[0].latitude,
                lon: res.data.results[0].longitude,
                name: res.data.results[0].name,
                country: res.data.results[0].country || ''
            };
        }
    } catch (e) { console.error("Erro no Geocoding:", e); }
    return null;
}

async function getWeatherInstant(lat: number, lon: number) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
        const res = await axios.get(url);
        return {
            temp: res.data.current.temperature_2m,
            code: res.data.current.weather_code
        };
    } catch (e) { console.warn('[CLIMA] Falha ao buscar clima atual:', lat, lon, e); return null; }
}

async function getWeatherHistorical(lat: number, lon: number, date: Date) {
    try {
        let queryYear = date.getUTCFullYear();
        if (queryYear < 1950) queryYear = 2000;
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const dateStr = `${queryYear}-${month}-${day}`;
        
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
        const res = await axios.get(url);
        if (!res.data.daily) return null;
        
        return {
            min: res.data.daily.temperature_2m_min[0],
            max: res.data.daily.temperature_2m_max[0],
            code: res.data.daily.weather_code[0]
        };
    } catch (e) { console.warn('[CLIMA] Falha ao buscar clima histórico:', lat, lon, e); return null; }
}

function wmoToText(code: number) {
    return WMO_TABLE[code] || "Desconhecido";
}


export default {
    name: 'clima',
    description: 'Sistema de Clima',
    data: new SlashCommandBuilder().setName('clima').setDescription('Comandos de clima'),

    async execute(message: Message, args: string[]) {
        let ClockModel;
        try { ClockModel = mainConnection.model('Clock'); } 
        catch (e) { console.warn('[CLIMA] ClockModel não encontrado - execute rp!time primeiro:', e); return message.reply("❌ Use `rp!time` primeiro para inicializar o sistema."); }

        if (args.length === 0) {
            return message.reply(
                "🌦️ **Sistema Climático**\n" +
                "`rp!clima <Local>` (Consulta Rápida)\n" +
                "`rp!clima #chat` (Consulta RP)\n" +
                "`rp!clima sync <Relógio> <Local>` (Sincronizar)\n" +
                "`rp!clima force <Relógio> <Condição>` (Forçar)\n" +
                "`rp!clima def` (Ver lista padrão)"
            );
        }

        const action = args[0].toLowerCase();

        if (action === 'help' || action === 'ajuda') {
            return message.reply(
                "🌦️ **Sistema Climático**\n\n" +
                "`rp!clima <Local>` (Consulta Rápida)\n" +
                "`rp!clima #canal` (Consulta RP do relógio do canal)\n" +
                "`rp!clima sync <Relógio> <Local>` (Vincular localização ao relógio)\n" +
                "`rp!clima force <Relógio> <Condição>` (Forçar clima — use `auto` para resetar)\n" +
                "`rp!clima def` (Ver lista de condições padrão WMO)"
            );
        }

        if (action.startsWith('<#')) {
            const cid = action.replace(/[<#>]/g, '');
            const clock = await ClockModel.findOne({ channelId: cid });

            if (!clock) return message.reply("❌ Não há relógio ativo neste canal.");
            
            const localNome = clock.locationName || "Desconhecido";
            
            const nowReal = Date.now();
            const diffReal = nowReal - clock.anchorReal; 
            const diffGame = diffReal * clock.velocity; 
            const currentRPGTime = new Date(clock.anchorRPG + diffGame);
            
            const dateStr = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(currentRPGTime);

            let climaTexto = "❓ Indisponível (Use `sync` para definir local)";
            
            if (clock.forcedWeather) {
                const isStandard = Object.values(WMO_TABLE).includes(clock.forcedWeather);
                if (isStandard) climaTexto = `⚠️ **${clock.forcedWeather}** (Manual)`;
                else climaTexto = `🚫 **${clock.forcedWeather}** (Anomalia)`;
            } else if (clock.latitude && clock.longitude) {
                const weather = await getWeatherHistorical(clock.latitude, clock.longitude, currentRPGTime);
                if (weather) {
                    climaTexto = `🌡️ Mín ${weather.min}°C / Máx ${weather.max}°C\n👀 ${wmoToText(weather.code)}`;
                } else {
                    climaTexto = "📡 Erro ao buscar dados históricos.";
                }
            }

            return message.reply(
                `🌍 **Clima em ${localNome}** (Data RP: ${dateStr})\n` +
                `${climaTexto}`
            );
        }

        if (action === 'def') {
            const list = Object.values(WMO_TABLE).map(c => `• ${c}`).join('\n');
            return message.reply(
                `📜 **Climas Padrão (WMO):**\n${list}\n\n` +
                `*Qualquer condição fora desta lista será tratada como Anomalia (🚫).*`
            );
        }

        if (action === 'force') {
            const clockName = args[1];
            const condition = args.slice(2).join(' ');
            if (!clockName || !condition) return message.reply(
                "⚠️ **Uso:** `rp!clima force <Relógio> <Condição>`\n" +
                "Use `auto` para voltar ao clima automático.\n" +
                "Ex: `rp!clima force Moscovo Tempestade ⚡`"
            );

            const isReset = ['null', 'auto', 'automático', '🚫', 'reset'].includes(condition.toLowerCase());
            const matched = isReset ? null : (matchStandardWeather(condition) ?? condition);

            const clockQuery = clockName.startsWith('<#')
                ? { channelId: clockName.replace(/[<#>]/g, '') }
                : { name: clockName };
            const res = await ClockModel.updateOne(clockQuery, { forcedWeather: matched });

            if (res.matchedCount === 0) return message.reply(`❌ Relógio **${clockName}** não encontrado.`);

            if (matched === null) return message.reply(`🔄 Clima de **${clockName}** voltou ao **automático**.`);
            const isStd = STANDARD_WEATHERS.includes(matched);
            return message.reply(`⚠️ Clima de **${clockName}** definido para: **${matched}**${isStd ? '' : '\n-# ⚠️ Condição não reconhecida — será exibida como Anomalia.'}.`);
        }

        if (action === 'sync') {
            // Suporta duas sintaxes:
            //   rp!clima sync #canal <Local>        → canal como identificador do relógio
            //   rp!clima sync <Local> #canal        → canal como identificador do relógio (ordem inversa)
            //   rp!clima sync <NomeRelógio> <Local> → relógio por nome
            const chanIdx = args.findIndex((a, i) => i >= 1 && a.startsWith('<#'));

            let clockFilter: Record<string, string>;
            let locationQuery: string;
            let clockLabel: string;

            if (chanIdx === 1) {
                // #canal no início: rp!clima sync #canal <Local>
                clockFilter  = { channelId: args[1].replace(/[<#>]/g, '') };
                clockLabel   = args[1];
                locationQuery = args.slice(2).join(' ');
            } else if (chanIdx > 1) {
                // #canal no final: rp!clima sync <Local> #canal
                locationQuery = args.slice(1, chanIdx).join(' ');
                clockFilter  = { channelId: args[chanIdx].replace(/[<#>]/g, '') };
                clockLabel   = args[chanIdx];
            } else {
                // Sem canal: rp!clima sync <NomeRelógio> <Local>
                clockFilter  = { name: args[1] ?? '' };
                clockLabel   = args[1] ?? '';
                locationQuery = args.slice(2).join(' ');
            }

            if (!clockLabel || !locationQuery) {
                return message.reply(
                    "⚠️ **Uso:** `rp!clima sync <#canal> <Local>` ou `rp!clima sync <NomeRelógio> <Local>`\n" +
                    "Ex: `rp!clima sync #planos Porto Alegre`"
                );
            }

            const msg = await message.reply("🔍 Buscando...");
            const geo = await getCoords(locationQuery);
            if (!geo) return msg.edit(`❌ Local não encontrado: **${locationQuery}**`);

            const res = await ClockModel.updateOne(
                clockFilter,
                { latitude: geo.lat, longitude: geo.lon, locationName: `${geo.name}${geo.country ? `, ${geo.country}` : ''}`, forcedWeather: null }
            );
            if (res.matchedCount === 0) return msg.edit(`❌ Relógio **${clockLabel}** não encontrado.`);
            return msg.edit(`🌍 **${clockLabel}** agora está em **${geo.name}${geo.country ? `, ${geo.country}` : ''}**.\n📡 Coordenadas: \`${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}\``);
        }

        const query = args.join(' ');
        const geo = await getCoords(query);
        if (!geo) return message.reply(`❌ Local não encontrado: "${query}"`);

        const weather = await getWeatherInstant(geo.lat, geo.lon);
        if (!weather) return message.reply("❌ Erro na API.");

        message.reply(
            `📍 **${geo.name}**\n` +
            `🌡️ **${weather.temp}°C**\n` +
            `👀 **${wmoToText(weather.code)}**\n` +
            `-# (Agora / Tempo Real)`
        );
    },

    async executeSlash(i: ChatInputCommandInteraction) { i.reply({content: "Use rp!clima", ephemeral: true}); }
};