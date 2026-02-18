"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = runSystemChecks;
const phone_1 = __importDefault(require("./commands/phone"));
const roll_1 = __importDefault(require("./commands/roll"));
const time_1 = __importDefault(require("./commands/time"));
const _42_1 = __importDefault(require("./commands/42"));
const webhook_1 = require("./commands/webhook");
const oc_1 = require("./commands/oc");
const ficha_1 = require("./commands/ficha");
const birthday_1 = __importDefault(require("./commands/birthday"));
const ServerStats_1 = __importDefault(require("./models/ServerStats"));
let clocksInitialized = false;
async function trackMessageStats(message) {
    if (!message.guild)
        return;
    const guildId = message.guild.id;
    const userId = message.webhookId || message.author.id;
    const channelId = message.channel.id;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const hour = now.getUTCHours();
    const content = message.content.toLowerCase();
    const rawWords = content.match(/[a-záàâãéèêíïóôõöúçñ]+/g) || [];
    const stopWords = new Set(['como', 'para', 'você', 'isso', 'mais', 'pelo', 'pela', 'esse', 'essa', 'este', 'esta', 'tudo', 'nada', 'quem', 'onde', 'quando', 'porque', 'qual', 'aqui', 'sobre', 'então', 'muito', 'dela', 'dele']);
    const wordCounts = {};
    for (const w of rawWords) {
        if (w.length > 3 && !stopWords.has(w)) {
            wordCounts[`words.${w}`] = (wordCounts[`words.${w}`] || 0) + 1;
        }
    }
    const updateQuery = {
        $inc: {
            total: 1,
            [`users.${userId}`]: 1,
            [`channels.${channelId}`]: 1,
            ...wordCounts
        }
    };
    ServerStats_1.default.findOneAndUpdate({ guildId, date: dateStr, hour }, updateQuery, { upsert: true, new: true, setDefaultsOnInsert: true }).catch(() => { });
}
async function runSystemChecks(message, client) {
    trackMessageStats(message);
    if (message.author.bot)
        return false;
    if (!clocksInitialized) {
        console.log("🛠️ Checkout acionado: Verificando relógios persistentes...");
        await time_1.default.checkAndRestoreClocks(client);
        clocksInitialized = true;
    }
    if (await (0, oc_1.handleAIMessage)(message))
        return true;
    if (await _42_1.default.processMessage(message))
        return true;
    await (0, webhook_1.handleOCMessage)(message);
    if (await phone_1.default.processPhoneMessage(message))
        return true;
    if (await roll_1.default.processRoll(message, message.content))
        return true;
    if (await (0, ficha_1.handleFichaSubmit)(message))
        return true;
    setInterval(() => {
        birthday_1.default.updateBirthdayPanels(client).catch(() => { });
    }, 1000 * 60 * 60);
    return false;
}
;
