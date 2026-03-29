import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleRename(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted || !extracted.rest) return message.reply("⚠️ Uso: `rp!oc rename \"Antigo Nome\" \"Novo Nome\"`");

    const oldName = extracted.name;
    // Extrai o novo nome removendo possíveis aspas
    const newNameMatch = extracted.rest.match(/^("([^"]+)"|'([^']+)'|([^\s]+))/);
    if (!newNameMatch) return message.reply("⚠️ Novo nome inválido.");
    
    const newName = newNameMatch[2] || newNameMatch[3] || newNameMatch[4];

    const updated = await OCModel.findOneAndUpdate(
        { adminId: userId, name: oldName },
        { name: newName },
        { new: true }
    );

    if (updated) {
        message.reply(`✏️ OC renomeado de **${oldName}** para **${newName}**!`);
    } else {
        message.reply(`❌ OC **${oldName}** não encontrado.`);
    }
}