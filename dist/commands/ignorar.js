"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ServerStats_1 = require("../models/ServerStats");
const messageTracker_1 = require("./messageTracker");
exports.default = {
    name: 'ignorar',
    description: 'Adiciona palavras à lista negra do contador de estatísticas.',
    aliases: ['blockword', 'ignoreword'],
    async execute(message, args) {
        if (!message.member?.permissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
            return message.reply("❌ Apenas administradores podem configurar a lista negra.");
        }
        const guildId = message.guild.id;
        const action = args[0]?.toLowerCase();
        const word = args[1]?.toLowerCase();
        if (!action || !['add', 'remove', 'list'].includes(action)) {
            return message.reply("Uso: `rp!ignorar add <palavra>`, `rp!ignorar remove <palavra>` ou `rp!ignorar list`");
        }
        if (action === 'list') {
            const doc = await ServerStats_1.BlockedWordsModel.findOne({ guildId });
            const words = doc?.words || [];
            if (words.length === 0)
                return message.reply("Nenhuma palavra está sendo ignorada.");
            return message.reply(`🛑 **Palavras ignoradas:** \`${words.join(', ')}\``);
        }
        if (!word)
            return message.reply("Especifique a palavra!");
        if (action === 'add') {
            await ServerStats_1.BlockedWordsModel.findOneAndUpdate({ guildId }, { $addToSet: { words: word } }, { upsert: true });
            await (0, messageTracker_1.loadBlockedWords)(guildId);
            return message.reply(`✅ A palavra **${word}** foi adicionada à lista de ignoradas!`);
        }
        if (action === 'remove') {
            await ServerStats_1.BlockedWordsModel.findOneAndUpdate({ guildId }, { $pull: { words: word } });
            await (0, messageTracker_1.loadBlockedWords)(guildId);
            return message.reply(`✅ A palavra **${word}** foi removida da lista de ignoradas!`);
        }
    }
};
