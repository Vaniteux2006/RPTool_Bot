// RPTool/supercommands/tempo/clockEngine.ts
// Motor de relógios — roda em background e edita mensagens a cada 30s
import { Client, TextChannel } from 'discord.js';
import { ClockModel, IClock } from '../../tools/models/ClockSchema';
import { getWeatherHistorical, wmoToEmoji, wmoToText, STANDARD_WEATHERS } from '../clima/weatherUtils';
import { runPool } from '../../tools/utils/pool';

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
// Cache das referências de Message: fetch de canal + mensagem eram 2 chamadas de
// API por relógio por tick. Guardamos a referência e só refazemos o fetch quando
// o edit falhar (mensagem apagada, canal recriado...).
const messageCache = new Map<string, import('discord.js').Message>();

// Guarda de sobreposição: o setInterval NÃO espera o tick anterior — com muitos
// relógios (fetch + HTTP cada) os ticks empilhavam.
let ticking = false;

async function tickOneClock(client: Client, clock: IClock & { id?: string }): Promise<void> {
    if (clock.paused) return;

    const rpgDate = computeRPGTime(clock);

    let weatherData = null;
    if (clock.latitude && clock.longitude && !clock.forcedWeather) {
        weatherData = await getWeatherHistorical(clock.latitude, clock.longitude, rpgDate);
    }

    const newContent = formatClockMessage(clock, rpgDate, weatherData);

    // 1º tenta a referência em cache — zero chamadas de API se nada mudou
    const cached = messageCache.get(clock.messageId);
    if (cached) {
        if (cached.content === newContent) return;
        try {
            await cached.edit(newContent);
            return;
        } catch {
            messageCache.delete(clock.messageId); // referência velha → refaz o fetch abaixo
        }
    }

    const channel = await client.channels.fetch(clock.channelId).catch(() => null) as TextChannel | null;
    if (!channel) return;

    const msg = await channel.messages.fetch(clock.messageId).catch(() => null);
    if (!msg) return;
    messageCache.set(clock.messageId, msg);

    if (msg.content !== newContent) await msg.edit(newContent);
}

export async function tickClocks(client: Client): Promise<void> {
    if (ticking) return; // tick anterior ainda rodando — pula esta rodada
    ticking = true;
    try {
        const clocks = await ClockModel.find({});
        await runPool(clocks, 4, async clock => {
            try {
                await tickOneClock(client, clock);
            } catch (e) {
                console.error(`[Clock Engine] Erro ao atualizar "${clock.name}":`, e);
            }
        });
    } catch (err) {
        console.error('[Clock Engine] Erro crítico no tick:', err);
    } finally {
        ticking = false;
    }
}

// ─── Inicialização (chamada uma única vez no commandCheckout) ─────────────────
export async function startClockEngine(client: Client): Promise<void> {
    if (engineRunning) return;
    engineRunning = true;
    // Migração de índices: derruba o unique global antigo em "name" e cria o
    // composto guildId+name (nomes de relógio são únicos por servidor).
    try {
        await ClockModel.syncIndexes();
    } catch (e) {
        console.warn('[Clock Engine] Falha ao sincronizar índices (seguindo mesmo assim):', e);
    }
    console.log('🕰️ [Clock Engine] Motor de relógios iniciado.');
    await tickClocks(client);
    setInterval(() => tickClocks(client), 30_000);
}