import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleAvatar(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc avatar \"Nome do OC\" url_do_avatar` (ou anexe uma imagem)");

    const name = extracted.name;
    const attachment = message.attachments.first();
    const urlInText = extracted.rest.split(/\s+/).find(a => a.startsWith("http"));
    
    const avatarUrl = attachment ? attachment.url : urlInText;

    if (!avatarUrl) return message.reply("❌ Você precisa anexar uma imagem ou passar o link direto!");

    const updated = await OCModel.findOneAndUpdate(
        { adminId: userId, name },
        { avatar: avatarUrl },
        { new: true }
    );

    if (updated) {
        message.reply(`🖼️ Avatar de **${name}** atualizado com sucesso!`);
    } else {
        message.reply(`❌ OC **${name}** não encontrado.`);
    }
}