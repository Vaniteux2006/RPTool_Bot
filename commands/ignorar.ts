import { Message, PermissionFlagsBits } from 'discord.js';
import { Command } from '../interfaces/Command';
import { BlockedWordsModel } from '../models/ServerStats';
import { loadBlockedWords } from './messageTracker';

export default {
    name: 'ignorar',
    description: 'Adiciona palavras à lista negra do contador de estatísticas.',
    aliases: ['blockword', 'ignoreword'],
    
    async execute(message: Message, args: string[]) {
        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ Apenas administradores podem configurar a lista negra.");
        }

        const guildId = message.guild!.id;
        const action = args[0]?.toLowerCase();
        const word = args[1]?.toLowerCase();

        if (!action || !['add', 'remove', 'list'].includes(action)) {
            return message.reply("Uso: `rp!ignorar add <palavra>`, `rp!ignorar remove <palavra>` ou `rp!ignorar list`");
        }

        if (action === 'list') {
            const doc = await BlockedWordsModel.findOne({ guildId });
            const words = doc?.words || [];
            if (words.length === 0) return message.reply("Nenhuma palavra está sendo ignorada.");
            return message.reply(`🛑 **Palavras ignoradas:** \`${words.join(', ')}\``);
        }

        if (!word) return message.reply("Especifique a palavra!");

        if (action === 'add') {
            await BlockedWordsModel.findOneAndUpdate(
                { guildId },
                { $addToSet: { words: word } },
                { upsert: true }
            );
            await loadBlockedWords(guildId); 
            return message.reply(`✅ A palavra **${word}** foi adicionada à lista de ignoradas!`);
        }

        if (action === 'remove') {
            await BlockedWordsModel.findOneAndUpdate(
                { guildId },
                { $pull: { words: word } }
            );
            await loadBlockedWords(guildId); 
            return message.reply(`✅ A palavra **${word}** foi removida da lista de ignoradas!`);
        }
    }
} as Command;