import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';
import { markAIChannel, recheckAIChannel } from '../../../tools/utils/ocCache';

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
            const canalAntigo = oc.ai.activeChannelId;
            oc.ai.enabled = false;
            oc.ai.activeChannelId = null; // encerra a sessão no canal
            oc.markModified('ai');
            await oc.save();
            if (canalAntigo) recheckAIChannel(canalAntigo).catch(() => null);
            return message.reply(`🔴 IA de **${oc.name}** foi desligada.`);
        }

        oc.ai.persona = extracted.rest; // Usando persona (Schema)
        oc.ai.enabled = true;
        oc.ai.activeChannelId = message.channel.id; // ativa a sessão NESTE canal
        oc.markModified('ai');
        await oc.save();
        markAIChannel(message.channel.id);
        return message.reply(`🟢 IA de **${oc.name}** ativada **neste canal** e persona atualizada!`);
    }

    oc.ai.enabled = true;
    oc.ai.activeChannelId = message.channel.id; // ativa a sessão NESTE canal
    oc.markModified('ai');
    await oc.save();
    markAIChannel(message.channel.id);
    return message.reply(`🟢 IA de **${oc.name}** ativada **neste canal**.`);
}