import { Message } from 'discord.js';

export default {
    name: '42',
    description: 'Responde à Pergunta Fundamental',

    async processMessage(message: Message): Promise<boolean> {
        // Ignora bots para evitar loops
        if (message.author.bot) return false;

        const triggerPhrase = "A resposta para a pergunta fundamental sobre a vida, o universo e tudo mais";

        // Verifica se o conteúdo da mensagem (ignorando maiúsculas/minúsculas) contém a frase exata
        // Usar 'includes' permite que funcione mesmo se tiver pontuação no final
        if (message.content.toLowerCase().includes(triggerPhrase.toLowerCase())) {
            await message.reply("42");
            return true;
        }

        return false;
    }
};