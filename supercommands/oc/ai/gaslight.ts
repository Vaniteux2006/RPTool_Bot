import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleGaslight(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted || !extracted.rest) return message.reply("⚠️ Uso: `rp!oc gaslight \"NomeOC\" Falsa memória aqui`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc || !oc.ai) return message.reply("❌ OC não encontrado ou IA não configurada.");

    if (!oc.ai.memories) oc.ai.memories = [];

    // Como não há 'history' no Schema, o Gaslight precisa virar uma memória profunda focada no contexto
    oc.ai.memories.push({ id: Date.now().toString(36), content: `[Manipulação de Contexto]: ${extracted.rest}` });

    oc.markModified('ai');
    await oc.save();

    return message.reply(`🔥 **${oc.name}** foi manipulado com sucesso. Ele agora acredita que: "${extracted.rest}"`);
}