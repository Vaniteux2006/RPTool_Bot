// RPTool/supercommands/tempo/clockEngine.ts
// Motor de relógios — roda em background e edita mensagens a cada 30s
import { Client, TextChannel } from 'discord.js';
import { ClockModel, IClock } from '../../tools/models/ClockSchema';
import { getWeatherHistorical, wmoToEmoji, wmoToText, STANDARD_WEATHERS } from '../clima/weatherUtils';

let engineRunning = false;

// ─── Calcula o tempo RP atual de um relógio ───────────────────────────────────
export function computeRPGTime(clock: IClock): Date {
    const diffReal = Date.now() - clock.anchorReal;
    const diffGame = diffReal * clock.velocity;
    return new Date(clock.anchorRPG + diffGame);
}

// ─── Formata o emoji de hora do dia ──────────────────────────────────────────
function timeOfDayEmoji(rpgDate: Date): string {
    const h = rpgDate.getUTCHours();
    if (h >= 5  && h < 7)  return '🌅';   // Amanhecer
    if (h >= 7  && h < 17) return '☀️';   // Dia
    if (h >= 17 && h < 19) return '🌇';   // Entardecer
    if (h >= 19 && h < 22) return '🌆';   // Noite inicial
    return '🌙';                            // Madrugada
}

// ─── Constrói o conteúdo da mensagem do relógio ───────────────────────────────
export function formatClockMessage(clock: IClock, rpgDate: Date, weatherData: any): string {
    const timeOpts: Intl.DateTimeFormatOptions  = { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' };
    const dateExtOpts: Intl.DateTimeFormatOptions = {
        timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    };
    const dateCurOpts: Intl.DateTimeFormatOptions = {
        timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
    };

    const horaStr    = new Intl.DateTimeFormat('pt-BR', timeOpts).format(rpgDate);
    let   dataExtenso = new Intl.DateTimeFormat('pt-BR', dateExtOpts).format(rpgDate);
    dataExtenso      = dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);
    const dataCurta  = new Intl.DateTimeFormat('pt-BR', dateCurOpts).format(rpgDate);

    // ─── Clima ────────────────────────────────────────────────────────────────
    let weatherEmoji = '';
    let weatherLine  = '';

    if (clock.forcedWeather) {
        const isStandard = STANDARD_WEATHERS.has(clock.forcedWeather);
        if (isStandard) {
            // Extrai o emoji que já está no texto WMO
            const m = clock.forcedWeather.match(/\p{Emoji_Presentation}/u);
            weatherEmoji = m ? m[0] : '🌤️';
            weatherLine  = `Condição Imposta: ${clock.forcedWeather}`;
        } else {
            weatherEmoji = '🚫';
            weatherLine  = `🚫 Anomalia — ${clock.forcedWeather}`;
        }
    } else if (weatherData) {
        weatherEmoji = wmoToEmoji(weatherData.code);
        weatherLine  = `${wmoToText(weatherData.code)}, entre ${weatherData.min}°C e ${weatherData.max}°C`;
    } else if (clock.latitude) {
        weatherEmoji = '📡';
        weatherLine  = 'Dados atmosféricos indisponíveis';
    }

    // ─── Velocidade (exibe só se diferente de 1:1) ────────────────────────────
    let velocityLine = '';
    if (clock.velocity !== 1) {
        const ratio = clock.velocity >= 1
            ? `1 min real = ${clock.velocity} min RP`
            : `${(1 / clock.velocity).toFixed(1)} min real = 1 min RP`;
        velocityLine = `\n> ⏩ *Velocidade: ${ratio}*`;
    }

    // ─── Localização ─────────────────────────────────────────────────────────
    const locationLine = clock.locationName ? `\n📍 ${clock.locationName}` : '';

    // ─── Header ───────────────────────────────────────────────────────────────
    const isAuto = clock.name.startsWith('AUTO_');
    let header = `# `;
    if (!isAuto) header += `< __${clock.name}__ > — `;
    header += `< ${horaStr} > ${timeOfDayEmoji(rpgDate)} ${weatherEmoji}`;

    // ─── Body ─────────────────────────────────────────────────────────────────
    let body = `\n## [ ${dataExtenso} ] (${dataCurta})`;
    if (locationLine) body += locationLine;
    if (weatherLine)  body += `\n${weatherLine}`;
    if (velocityLine) body += velocityLine;
    if (clock.paused) body += `\n\n⏸️ *Relógio pausado.*`;

    return header + body;
}

// ─── Ciclo de atualização ────────────────────────────────────────────────────
export async function tickClocks(client: Client): Promise<void> {
    try {
        const clocks = await ClockModel.find({});
        for (const clock of clocks) {
            try {
                if (clock.paused) continue;

                const channel = await client.channels.fetch(clock.channelId).catch(() => null) as TextChannel | null;
                if (!channel) continue;

                const msg = await channel.messages.fetch(clock.messageId).catch(() => null);
                if (!msg) continue;

                const rpgDate = computeRPGTime(clock);

                let weatherData = null;
                if (clock.latitude && clock.longitude && !clock.forcedWeather) {
                    weatherData = await getWeatherHistorical(clock.latitude, clock.longitude, rpgDate);
                }

                const newContent = formatClockMessage(clock, rpgDate, weatherData);
                if (msg.content !== newContent) {
                    await msg.edit(newContent);
                }
            } catch (e) {
                console.error(`[Clock Engine] Erro ao atualizar "${clock.name}":`, e);
            }
        }
    } catch (err) {
        console.error('[Clock Engine] Erro crítico no tick:', err);
    }
}

// ─── Inicialização (chamada uma única vez no command_checkout) ─────────────────
export async function startClockEngine(client: Client): Promise<void> {
    if (engineRunning) return;
    engineRunning = true;
    console.log('🕰️ [Clock Engine] Motor de relógios iniciado.');
    await tickClocks(client);
    setInterval(() => tickClocks(client), 30_000);
}