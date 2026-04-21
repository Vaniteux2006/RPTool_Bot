import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName, cleanWrapper } from '../utils';

export default async function handleCreate(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted || !extracted.rest) return message.reply("⚠️ Uso: `rp!oc create \"Nome\" prefixo:text`");

    const { name, rest } = extracted;

    const attachment = message.attachments.first();
    let patternRaw = rest;

    const urlInText = args.find(a => a.startsWith("http"));
    if (urlInText) patternRaw = patternRaw.replace(urlInText, "").trim();

    // Link padrão do Nosferatu caso o usuário não envie uma imagem
    const defaultAvatar = "https://media.discordapp.net/attachments/1328881429446398044/1474440885117653033/image.png?ex=6999db94&is=69988a14&hm=fcf89f47a01871198f54afbf0a58e6ee4c61f59df04180efb64a763f5f629389&=&format=webp&quality=lossless";
    
    // Pega o anexo, ou o link no texto, ou usa o avatar padrão
    const avatarUrl = attachment ? attachment.url : (urlInText || defaultAvatar);

    if (!patternRaw.includes("text")) return message.reply("⚠️ O padrão precisa ter **`text`**. Ex: `nome:text`");

    const parts = patternRaw.split("text");
    const prefix = cleanWrapper(parts[0].trim());
    const suffix = cleanWrapper(parts.slice(1).join("text").trim());

    const exists = await OCModel.findOne({ adminId: userId, name: name });
    if (exists) return message.reply("❌ Já existe um OC com esse nome!");

    await OCModel.create({
        adminId: userId,
        name: name,
        prefix: prefix,
        suffix: suffix,
        avatar: avatarUrl
    });

    return message.reply(`✅ OC **${name}** criado com sucesso!${avatarUrl === defaultAvatar ? " (Avatar padrão do Nosferatu aplicado 🧛‍♂️)" : ""}`);
}