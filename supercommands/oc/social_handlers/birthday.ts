import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleBirthday(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted || !extracted.rest) return message.reply("⚠️ Uso: `rp!oc birthday \"NomeOC\" DD/MM`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    if (extracted.rest.toLowerCase() === "remove") {
        oc.realBirthday = undefined;
        await oc.save();
        return message.reply(`🗑️ Aniversário de **${oc.name}** removido.`);
    }

    const [day, month] = extracted.rest.split("/").map(Number);
    if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) {
        return message.reply("⚠️ Formato inválido. Use `DD/MM` (ex: 25/12).");
    }

    // Cria a data (o ano não importa para o bot, apenas dia e mês)
    const bday = new Date();
    bday.setMonth(month - 1, day);
    oc.realBirthday = bday;
    await oc.save();

    return message.reply(`🎂 Aniversário de **${oc.name}** salvo para ${day}/${month}!`);
}