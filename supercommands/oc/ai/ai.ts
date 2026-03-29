import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleAI(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc ai \"NomeOC\" [Prompt de Personalidade]`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    if (!oc.ai) {
        oc.ai = { enabled: false, persona: "", activeChannelId: null, autoMode: false, replyDelay: 30, memories: [] };
    }

    if (extracted.rest) {
        if (extracted.rest.toLowerCase() === "off") {
            oc.ai.enabled = false;
            await oc.save();
            return message.reply(`🔴 IA de **${oc.name}** foi desligada.`);
        }

        oc.ai.persona = extracted.rest; // Usando persona (Schema)
        oc.ai.enabled = true;
        oc.markModified('ai');
        await oc.save();
        return message.reply(`🟢 IA de **${oc.name}** ativada e persona atualizada!`);
    }

    oc.ai.enabled = true;
    oc.markModified('ai');
    await oc.save();
    return message.reply(`🟢 IA de **${oc.name}** ativada.`);
}