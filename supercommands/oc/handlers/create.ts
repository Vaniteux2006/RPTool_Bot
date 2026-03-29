import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName, cleanWrapper } from '../utils'; // Ajuste o caminho do seu utils se precisar

export default async function handleCreate(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted || !extracted.rest) return message.reply("⚠️ Uso: `rp!oc create \"Nome\" prefixo:text`");

    const { name, rest } = extracted;

    const attachment = message.attachments.first();
    let patternRaw = rest;

    const urlInText = args.find(a => a.startsWith("http"));
    if (urlInText) patternRaw = patternRaw.replace(urlInText, "").trim();

    const avatarUrl = attachment ? attachment.url : urlInText;
    if (!avatarUrl) return message.reply("❌ Erro: Precisa de imagem (anexo ou link).");

    if (!patternRaw.includes("text")) return message.reply("⚠️ O padrão precisa ter **`text`**. Ex: `nome:text`");

    const parts = patternRaw.split("text");
    const prefix = cleanWrapper(parts[0].trim());
    const suffix = cleanWrapper(parts.slice(1).join("text").trim());

    const exists = await OCModel.findOne({ adminId: userId, name: name });
    if (exists) return message.reply("❌ Já existe um OC com esse nome!");

    await OCModel.create({
        adminId: userId, name, prefix, suffix, avatar: avatarUrl, createdAt: new Date()
    });

    let msg = `✅ OC **${name}** criado!\nExemplo: \`${prefix}Oi${suffix}\``;
    return message.reply(msg);
}