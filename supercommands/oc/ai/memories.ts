import { Message, EmbedBuilder } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleMemories(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc memories \"NomeOC\"`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc || !oc.ai || !oc.ai.memories || oc.ai.memories.length === 0) {
        return message.reply(`📭 **${oc?.name || "O personagem"}** não tem memórias profundas registradas.`);
    }

    // Adaptado para acessar o objeto
    const memList = oc.ai.memories.map((m: { id: string, content: string }, i: number) => `**${i + 1}.** [ID: \`${m.id}\`] ${m.content}`).join("\n");

    const embed = new EmbedBuilder()
        .setTitle(`🧠 Memórias Profundas: ${oc.name}`)
        .setDescription(memList)
        .setColor(0x8A2BE2);

    return message.reply({ embeds: [embed] });
}