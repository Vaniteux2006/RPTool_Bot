import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handlePuppet(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc puppet \"NomeOC\"`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    // Checa se o OC já está no modo manual
    if (!oc.ai || !oc.ai.enabled) {
        return message.reply(`🎭 **${oc.name}** já é apenas um fantoche (IA desligada). Use o padrão \`${oc.prefix || ""}text${oc.suffix || ""}\` para falar por ele.`);
    }

    // "Revoga o livre-arbítrio" (Desliga a IA)
    oc.ai.enabled = false;
    await oc.save();

    return message.reply(`🎭 O livre-arbítrio de **${oc.name}** foi revogado. Ele agora é um fantoche controlado apenas por você.`);
}