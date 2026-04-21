import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName, cleanWrapper } from '../utils'; 

export default async function handlePrefix(message: Message, args: string[], userId: string) {
    // Usa extractName pra isolar o nome do personagem do resto da string
    const extracted = extractName(message.content, args[0]);
    
    if (!extracted || !extracted.rest) {
        return message.reply("⚠️ Uso: `rp!oc prefix \"Nome\" prefixo:text`");
    }

    const { name, rest } = extracted;

    // A mesma trava de segurança do seu create
    if (!rest.includes("text")) {
        return message.reply("⚠️ O padrão precisa ter **`text`**. Ex: `nome:text`");
    }

    const oc = await OCModel.findOne({ adminId: userId, name: name });
    if (!oc) return message.reply("OC não encontrado.");

    // Separa prefixo e sufixo usando a mesma lógica original
    const parts = rest.split("text");
    oc.prefix = cleanWrapper(parts[0].trim());
    oc.suffix = cleanWrapper(parts.slice(1).join("text").trim());

    await oc.save();
    return message.reply(`✅ Padrão de **${oc.name}** atualizado!`);
}