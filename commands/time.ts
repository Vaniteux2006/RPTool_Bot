import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    Message, 
    TextChannel, 
    Client,
    ChannelType
} from 'discord.js';
import { Schema, Document } from 'mongoose'; 
import { mainConnection } from '../database'; 

interface IClock extends Document {
    name: string;
    channelId: string;
    messageId: string;
    anchorReal: number;
    anchorRPG: number;
    velocity: number;
    dilation: number;
    timezone: string;
    latitude?: number;
    longitude?: number;
    locationName?: string;
    forcedWeather?: string;
}

const ClockSchema = new Schema({
    name: { type: String, required: true, unique: true }, 
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    anchorReal: { type: Number, required: true }, 
    anchorRPG: { type: Number, required: true },
    velocity: { type: Number, default: 1 }, 
    dilation: { type: Number, default: 1 }, 
    timezone: { type: String, default: 'UTC' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    locationName: { type: String, default: null },
    forcedWeather: { type: String, default: null } 
});

export const ClockModel = mainConnection.models.Clock || mainConnection.model<IClock>('Clock', ClockSchema);

let isEngineRunning = false;

const WMO_TABLE: {[key: number]: string} = {
    0: "Céu Limpo ☀️", 1: "Poucas Nuvens 🌤️", 2: "Parcialmente Nublado ⛅", 3: "Nublado ☁️",
    45: "Nevoeiro 🌫️", 51: "Garoa 🌧️", 61: "Chuva ☔", 63: "Chuva Moderada ☔",
    71: "Neve 🌨️", 95: "Tempestade ⚡"
};
const STANDARD_WEATHERS = Object.values(WMO_TABLE);

function getWeatherEmoji(code: number): string {
    if (code === 0) return "☀️"; 
    if (code <= 3) return "⛅"; 
    if (code <= 48) return "🌫️"; 
    if (code <= 57) return "🌧️"; 
    if (code <= 67) return "☔"; 
    if (code <= 77) return "🌨️"; 
    if (code <= 82) return "⛈️"; 
    if (code <= 86) return "❄️"; 
    if (code <= 99) return "⚡"; 
    return "🌡️";
}

function getWeatherDesc(code: number): string {
    return WMO_TABLE[code] || "Clima Incerto";
}

async function fetchWeather(lat: number, lon: number, date: Date) {
    try {
        let queryYear = date.getUTCFullYear();
        if (queryYear < 1950) queryYear = 2000;
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const dateStr = `${queryYear}-${month}-${day}`;

        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (!data.daily || !data.daily.weather_code) return null;
        return {
            min: data.daily.temperature_2m_min[0],
            max: data.daily.temperature_2m_max[0],
            code: data.daily.weather_code[0]
        };
    } catch { return null; }
}

function parseTimeStr(str: string): number {
    if (!str) return 0;
    const match = str.match(/(\d+)([mhd])/i);
    if (!match) return 0;
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 'm') return val * 60 * 1000;
    if (unit === 'h') return val * 3600 * 1000;
    if (unit === 'd') return val * 24 * 3600 * 1000;
    return 0;
}

function calculateMultiplier(args: string[], symbol: string): number {
    const index = args.indexOf(symbol);
    if (index === -1) return 1; 
    const fromStr = args[index + 1];
    const arrow = args[index + 2];
    const toStr = args[index + 3];
    if (!fromStr || arrow !== '->' || !toStr) return 1;
    const fromMs = parseTimeStr(fromStr);
    const toMs = parseTimeStr(toStr);
    return fromMs === 0 ? 1 : toMs / fromMs;
}

function formatClockDisplay(clock: IClock | any, rpgDate: Date, earthDate: Date, weatherData: any) {
    const timeZone = 'UTC';
    const timeOptions: Intl.DateTimeFormatOptions = { timeZone, hour: '2-digit', minute: '2-digit' };
    const dateExtensoOptions: Intl.DateTimeFormatOptions = { timeZone, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    const dateCurtaOptions: Intl.DateTimeFormatOptions = { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' };

    const hourStr = new Intl.DateTimeFormat('pt-BR', { timeZone, hour: 'numeric', hour12: false }).format(rpgDate);
    const h = parseInt(hourStr);
    
    let timeEmoji = '🌑';
    if (h >= 5 && h < 7) timeEmoji = ':sunrise:';
    else if (h >= 7 && h < 17) timeEmoji = ':sunny:';
    else if (h >= 17 && h < 19) timeEmoji = ':city_sunset:';
    else if (h >= 19 && h < 22) timeEmoji = ':city_dusk:';
    
    let weatherEmoji = '';
    let weatherDesc = '';

    if (clock.forcedWeather) {
        const isStandard = STANDARD_WEATHERS.includes(clock.forcedWeather);

        if (isStandard) {
            const emojiMatch = clock.forcedWeather.match(/[\u{1F300}-\u{1F9FF}]/u);
            weatherEmoji = emojiMatch ? emojiMatch[0] : '🌤️'; 
            weatherDesc = `Condição Imposta: ${clock.forcedWeather}`;
        } else {
            weatherEmoji = '🚫';
            weatherDesc = `🚫 - ${clock.forcedWeather}`;
        }

    } else if (weatherData) {
        weatherEmoji = getWeatherEmoji(weatherData.code);
        weatherDesc = ` ${getWeatherDesc(weatherData.code)}, entre ${weatherData.min}°C e ${weatherData.max}°C `;
    } else if (clock.latitude) {
        weatherEmoji = '📡';
        weatherDesc = `Dados atmosféricos indisponíveis`;
    }

    const horaFormatada = new Intl.DateTimeFormat('pt-BR', timeOptions).format(rpgDate);
    let dataExtenso = new Intl.DateTimeFormat('pt-BR', dateExtensoOptions).format(rpgDate);
    dataExtenso = dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);
    const dataCurta = new Intl.DateTimeFormat('pt-BR', dateCurtaOptions).format(rpgDate);

    let header = `# `;
    if (!clock.name.startsWith("AUTO_")) {
        header += `< __${clock.name}__ > - `;
    }
    header += `< ${horaFormatada} > ${timeEmoji} ${weatherEmoji}`;

    let body = `\n## [ ${dataExtenso} ] (${dataCurta})`;
    
    if (weatherDesc) {
        body += `\n${weatherDesc}`;
    }

    if (clock.dilation !== 1) {
        const diffMs = Math.abs(earthDate.getTime() - rpgDate.getTime());
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 0) body += `\n> *Desvio: ${diffDays} dias*`;
    }

    return header + body;
}

export default {
    name: 'time',
    description: 'Motor de Tempo e Espaço',
    data: new SlashCommandBuilder().setName('time').setDescription('Use rp!time'),

    async checkAndRestoreClocks(client: Client) {
        if (isEngineRunning) return;
        isEngineRunning = true;
        console.log("🕰️ [Time Engine] Iniciado.");
        this.updateClocks(client);
        setInterval(() => this.updateClocks(client), 30000);
    },

    async updateClocks(client: Client) {
        try {
            const clocks = await ClockModel.find({});
            for (const clock of clocks) {
                try {
                    const channel = await client.channels.fetch(clock.channelId) as TextChannel;
                    if (!channel) continue;
                    
                    const msg = await channel.messages.fetch(clock.messageId).catch(() => null);
                    if (!msg) continue; 

                    const nowReal = Date.now();
                    const diffReal = nowReal - clock.anchorReal; 
                    const diffGame = diffReal * clock.velocity; 
                    const currentRPGTime = new Date(clock.anchorRPG + diffGame);
                    const currentEarthTime = new Date(clock.anchorRPG + (diffGame * clock.dilation));

                    let weatherData = null;
                    if (clock.latitude && clock.longitude && !clock.forcedWeather) {
                        weatherData = await fetchWeather(clock.latitude, clock.longitude, currentRPGTime);
                    }

                    const newContent = formatClockDisplay(clock, currentRPGTime, currentEarthTime, weatherData);
                    if (msg.content !== newContent) await msg.edit(newContent);

                } catch (e) { console.error(`Erro clock ${clock.name}:`, e); }
            }
        } catch (err) { console.error(err); }
    },

    async execute(message: Message, args: string[]) {
        if (args.length === 0) {
            return message.reply(
                "🕰️ **Sistema Temporal - Guia de Comandos**\n\n" +
                "🔹 **Básico**\n" +
                "`rp!time #canal [Fuso]`\n" +
                "> Cria um relógio simples.\n\n" +
                "🔹 **Avançado (Sci-Fi)**\n" +
                "`rp!time set <Nome> [#Canal] <Data> <Hora> [Mods]`\n" +
                "> Cria relógio customizado. \n" +
                "> *Ex: `rp!time set QWERT 01/01/1914 12:00 + 1m -> 1h`*\n\n" +
                "🔹 **Controles**\n" +
                "`rp!time skip <Nome> <Tempo>` → Avança o tempo.\n" +
                "`rp!time delete <Nome>` → Deleta.\n" +
                "`rp!time list` → Lista ativos."
            );
        }
        
        const action = args[0].toLowerCase();
        
        if (action.startsWith('<#')) {
            const cid = action.replace(/[<#>]/g, '');
            const ch = message.guild?.channels.cache.get(cid) as TextChannel;
            if (!ch) return message.reply("❌ Canal inválido.");
            
            const autoName = `AUTO_${ch.id}`;
            await ClockModel.deleteOne({ name: autoName });
            
            const msg = await ch.send("⏳ Iniciando relógio...");
            await ClockModel.create({
                name: autoName, channelId: ch.id, messageId: msg.id,
                anchorReal: Date.now(), anchorRPG: Date.now(),
                velocity: 1, dilation: 1, timezone: 'UTC', latitude: null, longitude: null, locationName: null
            });
            return message.reply(`✅ Relógio simples criado em ${ch}.`);
        }

        if (action === 'set') {
            let targetChannel = message.channel as TextChannel;
            let name = "";
            let dateStr = "";
            let timeStr = "";
            let modsIndex = 0;

            if (args[1] && args[1].startsWith('<#')) {
                const cid = args[1].replace(/[<#>]/g, '');
                const ch = message.guild?.channels.cache.get(cid) as TextChannel;
                if (ch) targetChannel = ch;
                name = args[2]; dateStr = args[3]; timeStr = args[4]; modsIndex = 5;
            } else if (args[2] && args[2].startsWith('<#')) {
                name = args[1];
                const cid = args[2].replace(/[<#>]/g, '');
                const ch = message.guild?.channels.cache.get(cid) as TextChannel;
                if (ch) targetChannel = ch;
                dateStr = args[3]; timeStr = args[4]; modsIndex = 5;
            } else {
                name = args[1]; dateStr = args[2]; timeStr = args[3]; modsIndex = 4;
            }

            if (!name || !dateStr || !timeStr) return message.reply("❌ Uso: `rp!time set NOME 01/01/1914 12:00`");

            const mods = args.slice(modsIndex).join(' ');
            const [day, month, year] = dateStr.split('/').map(Number);
            const [hour, min] = timeStr.split(':').map(Number);
            const initialRPGDate = new Date(Date.UTC(year, month - 1, day, hour, min));

            if (isNaN(initialRPGDate.getTime())) return message.reply(`❌ Data Inválida!`);

            const velocity = calculateMultiplier(args, '+');
            const dilation = calculateMultiplier(args, '/');
            const oldClock = await ClockModel.findOne({ name });
            const lat = oldClock ? oldClock.latitude : null;
            const lon = oldClock ? oldClock.longitude : null;
            const locName = oldClock ? oldClock.locationName : null;

            await ClockModel.deleteOne({ name });
            const msg = await targetChannel.send("⏳ Iniciando...");

            await ClockModel.create({
                name, channelId: targetChannel.id, messageId: msg.id,
                anchorReal: Date.now(), anchorRPG: initialRPGDate.getTime(),
                velocity, dilation, timezone: 'UTC',
                latitude: lat, longitude: lon, locationName: locName
            });

            await msg.edit(formatClockDisplay({ name, dilation, forcedWeather: null, latitude: lat }, initialRPGDate, initialRPGDate, null));
            message.reply(`✅ Relógio **${name}** definido em ${targetChannel}!`);
        }
        
        else if (action === 'delete') {
            const target = args[1];
            await ClockModel.deleteOne({ name: target });
            message.reply("🗑️ Deletado.");
        }
        else if (action === 'skip') {
             const name = args[1];
             const amount = parseTimeStr(args[2]);
             const clock = await ClockModel.findOne({ name });
             if(clock) {
                 const now = Date.now();
                 const current = clock.anchorRPG + (now - clock.anchorReal) * clock.velocity;
                 clock.anchorReal = now;
                 clock.anchorRPG = current + amount;
                 await clock.save();
                 message.reply(`⏩ Saltou.`);
             } else message.reply("❌ Não achei o relógio.");
        }
        else if (action === 'list') {
            const all = await ClockModel.find({});
            message.reply(all.map(c => `**${c.name}** em <#${c.channelId}>`).join('\n') || "Nenhum relógio ativo.");
        }
    },
    
    async executeSlash(i: ChatInputCommandInteraction) { i.reply({content: "Use rp!time", ephemeral: true}); }
};