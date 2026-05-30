// RPTool/supercommands/clima/handlers/weather.ts
import { Message } from 'discord.js';
import { ClockModel } from '../../../tools/models/ClockSchema';
import {
    getCoords,
    getWeatherInstant,
    getWeatherHistorical,
    wmoToText,
    wmoToEmoji,
    WMO_TABLE,
    STANDARD_WEATHERS,
} from '../weatherUtils';
import { computeRPGTime } from '../../tempo/clockEngine';
import { extractArgs } from '../../../tools/utils/textUtils';

// ─── rp!clima <Local> ────────────────────────────────────────────────────────
// Consulta clima atual (tempo real) em qualquer lugar
export async function handleLookup(message: Message, args: string[]) {
    const query = args.join(' ');
    if (!query) return message.reply('⚠️ **Uso:** `rp!clima <Local>`\nEx: `rp!clima Seattle`');

    const waitMsg = await message.reply('🔍 Buscando...');
    const geo     = await getCoords(query);
    if (!geo) return waitMsg.edit(`❌ Local não encontrado: **${query}**`);

    const weather = await getWeatherInstant(geo.lat, geo.lon);
    if (!weather) return waitMsg.edit('❌ Erro na API de clima. Tente novamente.');

    await waitMsg.edit(
        `📍 **${geo.name}${geo.country ? `, ${geo.country}` : ''}**\n` +
        `🌡️ **${weather.temp}°C**\n` +
        `${wmoToEmoji(weather.code)} **${wmoToText(weather.code)}**\n` +
        `-# (Tempo real, agora)`,
    );
}

// ─── rp!clima #canal ─────────────────────────────────────────────────────────
// Consulta o clima do relógio vinculado a um canal RP
export async function handleRPQuery(message: Message, channelId: string) {
    const clock = await ClockModel.findOne({ channelId, guildId: message.guild!.id });
    if (!clock) return message.reply('❌ Não há relógio ativo neste canal.\nCrie um com `rp!tempo #canal`.');

    const rpgDate  = computeRPGTime(clock);
    const dateStr  = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'long' }).format(rpgDate);
    const localNome = clock.locationName ?? 'local não definido';

    let climaTexto: string;

    if (clock.forcedWeather) {
        const isStd = STANDARD_WEATHERS.has(clock.forcedWeather);
        climaTexto  = isStd
            ? `⚠️ **${clock.forcedWeather}** *(Condição imposta manualmente)*`
            : `🚫 **${clock.forcedWeather}** *(Anomalia — fora dos padrões WMO)*`;
    } else if (clock.latitude && clock.longitude) {
        const weather = await getWeatherHistorical(clock.latitude, clock.longitude, rpgDate);
        if (weather) {
            climaTexto =
                `${wmoToEmoji(weather.code)} **${wmoToText(weather.code)}**\n` +
                `🌡️ Mín ${weather.min}°C / Máx ${weather.max}°C`;
        } else {
            climaTexto = '📡 Dados históricos indisponíveis para esta data/local.';
        }
    } else {
        climaTexto = '❓ Localização não definida.\nUse `rp!clima sync <Nome do Relógio> <Local>` para vincular.';
    }

    return message.reply(
        `🌍 **Clima em ${localNome}**\n` +
        `📅 *(Data RP: ${dateStr})*\n\n` +
        climaTexto,
    );
}

// ─── rp!clima sync <Nome> <Local> ────────────────────────────────────────────
// Vincula um local geográfico a um relógio (habilita clima automático)
export async function handleSync(message: Message, args: string[]) {
    const name  = args[1];
    const query = args.slice(2).join(' ');

    if (!name || !query) {
        return message.reply(
            '⚠️ **Uso:** `rp!clima sync <Nome do Relógio> <Local>`\n' +
            'Ex: `rp!clima sync Seattle Seattle, USA`',
        );
    }

    if (!message.guild!.members.cache.get(message.author.id)?.permissions.has('ManageChannels')) {
        return message.reply('❌ Você precisa de permissão **Gerenciar Canais** para sincronizar o clima.');
    }

    const waitMsg = await message.reply('🔍 Buscando coordenadas...');
    const geo     = await getCoords(query);
    if (!geo) return waitMsg.edit(`❌ Local não encontrado: **${query}**`);

    const res = await ClockModel.updateOne(
        { name, guildId: message.guild!.id },
        {
            latitude:      geo.lat,
            longitude:     geo.lon,
            locationName:  `${geo.name}${geo.country ? `, ${geo.country}` : ''}`,
            forcedWeather: null,
        },
    );

    if (res.matchedCount === 0) return waitMsg.edit(`❌ Relógio **${name}** não encontrado neste servidor.`);

    return waitMsg.edit(
        `🌍 Relógio **${name}** sincronizado com **${geo.name}${geo.country ? `, ${geo.country}` : ''}**\n` +
        `📡 Coordenadas: \`${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}\`\n` +
        `O clima agora será buscado automaticamente com base na data RP.`,
    );
}

// ─── rp!clima force <Nome> <Condição> ────────────────────────────────────────
// Força uma condição climática em um relógio (override manual)
// Use "null" ou "auto" para voltar ao automático
export async function handleForce(message: Message, args: string[]) {
    const name      = args[1];
    const condition = args.slice(2).join(' ');

    if (!name || !condition) {
        return message.reply(
            '⚠️ **Uso:** `rp!clima force <Nome do Relógio> <Condição>`\n' +
            'Ex: `rp!clima force Seattle Tempestade ⚡`\n' +
            'Para voltar ao automático: `rp!clima force Seattle auto`\n' +
            'Para criar uma Anomalia: `rp!clima force Seattle Chuva de Cinzas 🌋`',
        );
    }

    if (!message.guild!.members.cache.get(message.author.id)?.permissions.has('ManageChannels')) {
        return message.reply('❌ Você precisa de permissão **Gerenciar Canais** para forçar o clima.');
    }

    const isReset = ['null', 'auto', 'automático', '🚫', 'reset'].includes(condition.toLowerCase());
    const val     = isReset ? null : condition;

    const res = await ClockModel.updateOne(
        { name, guildId: message.guild!.id },
        { forcedWeather: val },
    );

    if (res.matchedCount === 0) return message.reply(`❌ Relógio **${name}** não encontrado.`);

    if (isReset) {
        return message.reply(`🔄 Clima de **${name}** voltou ao **automático**.`);
    }

    const isStd     = STANDARD_WEATHERS.has(val!);
    const typeLabel = isStd ? 'Condição padrão WMO' : '🚫 Anomalia';

    return message.reply(
        `⚠️ Clima de **${name}** definido para: **${val}**\n` +
        `-# ${typeLabel}`,
    );
}

// ─── rp!clima def ─────────────────────────────────────────────────────────────
// Lista todas as condições WMO padrão disponíveis
export async function handleDef(message: Message) {
    const list = Object.values(WMO_TABLE).map(c => `• ${c}`).join('\n');
    return message.reply(
        `📜 **Condições Climáticas Padrão (WMO):**\n${list}\n\n` +
        `-# Qualquer texto fora desta lista será tratado como **Anomalia** 🚫 no relógio.`,
    );
}

// ─── rp!clima historico <Local> <DD/MM/AAAA> ─────────────────────────────────
// Consulta clima histórico de qualquer local em qualquer data
// (sem precisar de um relógio — direto para o usuário)
export async function handleHistorical(message: Message, args: string[]) {
    // args[1] = nome/coords, args[args.length-1] = data
    const dateRaw = args[args.length - 1];
    const query   = args.slice(1, -1).join(' ');

    if (!query || !dateRaw) {
        return message.reply(
            '⚠️ **Uso:** `rp!clima historico <Local> <DD/MM/AAAA>`\n' +
            'Ex: `rp!clima historico Seattle 15/08/2005`',
        );
    }

    const dateParts = dateRaw.split('/').map(Number);
    if (dateParts.length !== 3 || dateParts.some(isNaN)) {
        return message.reply('❌ Data inválida. Use o formato `DD/MM/AAAA`.');
    }

    const [day, month, year] = dateParts;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (isNaN(date.getTime())) return message.reply('❌ Data inválida.');

    const waitMsg = await message.reply('🔍 Buscando dados históricos...');
    const geo     = await getCoords(query);
    if (!geo) return waitMsg.edit(`❌ Local não encontrado: **${query}**`);

    const weather = await getWeatherHistorical(geo.lat, geo.lon, date);
    if (!weather) return waitMsg.edit('❌ Dados históricos indisponíveis para esta data/local.');

    const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'long' }).format(date);

    return waitMsg.edit(
        `📍 **${geo.name}${geo.country ? `, ${geo.country}` : ''}** — ${dateFmt}\n` +
        `${wmoToEmoji(weather.code)} **${wmoToText(weather.code)}**\n` +
        `🌡️ Mín **${weather.min}°C** / Máx **${weather.max}°C**\n` +
        `-# (Dados históricos via Open-Meteo Archive)`,
    );
}