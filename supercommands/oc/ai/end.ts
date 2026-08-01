import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';
import { recheckAIChannel } from '../../../tools/utils/ocCache';

export default async function handleEnd(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc end \"NomeOC\"`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc || !oc.ai) return message.reply("❌ OC não encontrado ou IA já desativada.");

    const canalAntigo = oc.ai.activeChannelId;
    oc.ai.enabled = false;
    oc.ai.activeChannelId = null; // Libera o canal para encerrar a sessão
    oc.markModified('ai');
    await oc.save();
    if (canalAntigo) recheckAIChannel(canalAntigo).catch(() => null);

    return message.reply(`🎬 A sessão com **${oc.name}** foi encerrada.`);
}