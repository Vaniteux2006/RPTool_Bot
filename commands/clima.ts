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


async function getCoords(query: string) {
    const coordRegex = /([0-9]+[.,]?[0-9]*)\s*([NS])?[,\s]*([0-9]+[.,]?[0-9]*)\s*([WE])?/i;
    const match = query.match(coordRegex);

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
    } catch (e) { return null; }
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
    } catch { return null; }
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
        catch (e) { return message.reply("❌ Use `rp!time` primeiro para inicializar o sistema."); }

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
            if (!clockName || !condition) return message.reply("❌ Uso: `rp!clima force <Relógio> <Texto>`");
            
            // Permite resetar com "null" ou "🚫"
            const val = (condition === '🚫' || condition === 'null') ? null : condition;
            
            await ClockModel.updateOne({ name: clockName }, { forcedWeather: val });
            return message.reply(`⚠️ Clima de **${clockName}** definido para: **${val || 'Automático'}**.`);
        }

        if (action === 'sync') {
            const clockName = args[1];
            const query = args.slice(2).join(' ');
            if (!clockName || !query) return message.reply("❌ Uso: `rp!clima sync <Relógio> <Lugar>`");

            const msg = await message.reply("🔍 Buscando...");
            const geo = await getCoords(query);
            if (!geo) return msg.edit("❌ Local não encontrado.");

            const res = await ClockModel.updateOne(
                { name: clockName },
                { latitude: geo.lat, longitude: geo.lon, locationName: `${geo.name}, ${geo.country}`, forcedWeather: null }
            );
            if (res.matchedCount === 0) return msg.edit("❌ Relógio não encontrado.");
            return msg.edit(`🌍 **${clockName}** agora está em **${geo.name}**.`);
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