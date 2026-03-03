import { Message, PermissionFlagsBits } from 'discord.js';
import { Command } from '../interfaces/Command';
import ServerStats, { BlockedWordsModel } from '../models/ServerStats';
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

        if (!action || !['add', 'remove', 'list', 'clean'].includes(action)) {
            return message.reply("Uso: `rp!ignorar add <palavra>`, `remove <palavra>`, `list`, ou `clean`");
        }

        if (action === 'list') {
            const doc = await BlockedWordsModel.findOne({ guildId });
            const words = doc?.words || [];
            if (words.length === 0) return message.reply("Nenhuma palavra está sendo ignorada.");
            return message.reply(`🛑 **Palavras ignoradas:** \`${words.join(', ')}\``);
        }

        // 🟢 O EFEITO THANOS: Apaga as palavras do passado
        if (action === 'clean') {
            const doc = await BlockedWordsModel.findOne({ guildId });
            const words = doc?.words || [];
            if (words.length === 0) return message.reply("A lista negra está vazia. Não há o que limpar.");

            await message.reply("🧹 **Efeito Thanos:** Apagando palavras bloqueadas do histórico de todos os dias... 🫰");

            const unsetObj: any = {};
            for (const w of words) {
                unsetObj[`words.${w}`] = ""; // Prepara o comando para deletar a chave do banco
            }

            // O $unset vai fisicamente no MongoDB e deleta essas palavras do passado
            await ServerStats.updateMany(
                { guildId },
                { $unset: unsetObj }
            );

            return message.reply("✨ **Limpeza temporal concluída!** As palavras ignoradas foram apagadas do passado, presente e futuro.");
        }

        if (!word) return message.reply("Especifique a palavra!");

        if (action === 'add') {
            await BlockedWordsModel.findOneAndUpdate(
                { guildId },
                { $addToSet: { words: word } },
                { upsert: true }
            );
            await loadBlockedWords(guildId);
            return message.reply(`✅ A palavra **${word}** foi adicionada à lista! (Para sumir com as antigas, use \`rp!ignorar clean\`)`);
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