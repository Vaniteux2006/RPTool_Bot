import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleDelay(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted || !extracted.rest) return message.reply("⚠️ Uso: `rp!oc delay \"NomeOC\" [Segundos]`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    const delaySeconds = parseInt(extracted.rest);
    if (isNaN(delaySeconds) || delaySeconds < 0 || delaySeconds > 60) {
        return message.reply("⚠️ O delay deve ser um número entre 0 e 60 segundos.");
    }

    if (!oc.ai) {
        oc.ai = { enabled: false, persona: "", activeChannelId: null, autoMode: false, replyDelay: 30, memories: [] };
    }
    
    oc.ai.replyDelay = delaySeconds; // Usando replyDelay (Schema)
    oc.markModified('ai');
    await oc.save();

    return message.reply(`⏳ Delay de resposta de **${oc.name}** definido para **${delaySeconds}s**.`);
}