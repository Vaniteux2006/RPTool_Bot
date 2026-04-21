import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleAvatar(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("Qual OC? `rp!oc avatar \"Nome\"`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("OC não encontrado.");

    const attachment = message.attachments.first();
    const newAvatar = attachment ? attachment.url : (extracted.rest.startsWith("http") ? extracted.rest : null);

    if (!newAvatar) return message.reply(`🖼️ Avatar atual de **${oc.name}**: ${oc.avatar}`);

    oc.avatar = newAvatar;
    await oc.save();
    return message.reply("✅ Avatar atualizado!");
}