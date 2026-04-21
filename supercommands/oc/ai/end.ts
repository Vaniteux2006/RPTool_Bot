import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleEnd(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc end \"NomeOC\"`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc || !oc.ai) return message.reply("❌ OC não encontrado ou IA já desativada.");

    oc.ai.enabled = false;
    oc.ai.activeChannelId = null; // Libera o canal para encerrar a sessão
    oc.markModified('ai');
    await oc.save();

    return message.reply(`🎬 A sessão com **${oc.name}** foi encerrada.`);
}