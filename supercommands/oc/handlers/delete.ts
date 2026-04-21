import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleDelete(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("Qual OC? `rp!oc delete \"Nome\"`");

    // Deleta apenas o OC especificado, exatamente como no seu código original
    const deleted = await OCModel.findOneAndDelete({ adminId: userId, name: extracted.name });
    
    if (!deleted) return message.reply("OC não encontrado.");

    return message.reply(`🗑️ OC **${extracted.name}** deletado.`);
}