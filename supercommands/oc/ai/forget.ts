import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleForget(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc forget \"NomeOC\" [ID da Memória]`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc || !oc.ai || !oc.ai.memories || oc.ai.memories.length === 0) {
        return message.reply("❌ Nenhuma memória registrada para esquecer.");
    }

    if (extracted.rest) {
        // Se passou ID, remove a específica
        const initialLength = oc.ai.memories.length;
        oc.ai.memories = oc.ai.memories.filter(m => m.id !== extracted.rest.trim());
        if (oc.ai.memories.length === initialLength) return message.reply("❌ Memória não encontrada com esse ID.");
    } else {
        // Se não passou ID, remove a última inserida
        oc.ai.memories.pop();
    }

    oc.markModified('ai');
    await oc.save();

    return message.reply(`✂️ Memória de **${oc.name}** foi apagada.`);
}