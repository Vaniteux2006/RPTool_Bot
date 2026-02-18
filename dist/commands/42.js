"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    name: '42',
    description: 'Responde à Pergunta Fundamental',
    async processMessage(message) {
        if (message.author.bot)
            return false;
        const triggerPhrase = "A resposta para a pergunta fundamental sobre a vida, o universo e tudo mais";
        if (message.content.toLowerCase().includes(triggerPhrase.toLowerCase())) {
            await message.reply("42");
            return true;
        }
        return false;
    }
};
