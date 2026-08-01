import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';
import { recheckUserOC } from '../../../tools/utils/ocCache';

export default async function handleSolo(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc solo \"NomeOC\"`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    const exDuos = [...(oc.duoIds || [])];
    oc.duoIds = []; // Limpa a array de acessos
    await oc.save();
    for (const exDuo of exDuos) recheckUserOC(exDuo).catch(() => null);

    return message.reply(`🔒 **${oc.name}** agora é exclusivo seu novamente.`);
}