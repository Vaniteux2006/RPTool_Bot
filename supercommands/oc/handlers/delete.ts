import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleDelete(message: Message, args: string[], userId: string) {
    if (args[1]?.toLowerCase() === "all") {
        await OCModel.deleteMany({ adminId: userId });
        return message.reply("💥 **TODOS** os seus OCs foram deletados.");
    }

    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc delete \"Nome do OC\"`");

    const deleted = await OCModel.findOneAndDelete({ adminId: userId, name: extracted.name });
    
    if (deleted) {
        message.reply(`🗑️ OC **${extracted.name}** foi deletado.`);
    } else {
        message.reply(`❌ OC **${extracted.name}** não encontrado.`);
    }
}