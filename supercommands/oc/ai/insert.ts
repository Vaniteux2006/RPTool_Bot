import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleInsert(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted || !extracted.rest) return message.reply("⚠️ Uso: `rp!oc insert \"NomeOC\" Fato permanente`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    if (!oc.ai) {
        oc.ai = { enabled: false, persona: "", activeChannelId: null, autoMode: false, replyDelay: 30, memories: [] };
    }
    if (!oc.ai.memories) oc.ai.memories = [];

    // O Schema exige um ID e um Content
    const newMemoryId = Date.now().toString(36);
    oc.ai.memories.push({ id: newMemoryId, content: extracted.rest });
    
    oc.markModified('ai');
    await oc.save();

    return message.reply(`📌 Fato inserido na memória profunda de **${oc.name}**: "${extracted.rest}"\n*(ID: \`${newMemoryId}\`)*`);
}