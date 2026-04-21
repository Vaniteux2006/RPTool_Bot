import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleAlzheimer(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc alzheimer \"NomeOC\"`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc || !oc.ai) return message.reply("❌ OC não encontrado ou IA não configurada.");

    oc.ai.activeChannelId = null; // Ao tirar o canal ativo, ele perde a referência do contexto atual
    oc.markModified('ai');
    await oc.save();

    return message.reply(`🧠🌪️ **${oc.name}** sofreu alzheimer (Esqueceu o contexto atual do canal).`);
}