import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema'; // Ajuste o caminho pro seu DB
import { extractName, cleanWrapper } from '../utils';

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
    const prefix = cleanWrapper(parts[0]);
    const suffix = cleanWrapper(parts.slice(1).join("text"));

    try {
        const existingOC = await OCModel.findOne({ adminId: userId, name });
        if (existingOC) return message.reply(`❌ Você já tem um OC chamado **${name}**!`);

        const newOC = new OCModel({
            adminId: userId,
            name,
            prefix,
            suffix,
            avatar: avatarUrl,
            messageCount: 0,
            createdAt: new Date()
        });

        await newOC.save();
        message.reply(`✅ OC **${name}** criado com sucesso!\nPara usar: \`${prefix}Texto${suffix}\``);
    } catch (error) {
        console.error("Erro ao criar OC:", error);
        message.reply("❌ Ocorreu um erro ao salvar o OC.");
    }
}