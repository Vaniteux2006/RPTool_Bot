import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';

export default async function handleRename(message: Message, args: string[], userId: string, action: string) {
    const rawArgs = message.content.slice(message.content.toLowerCase().indexOf(action) + action.length).trim();
    const match = rawArgs.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))$/);

    if (!match) return message.reply("Uso: `rp!oc rename \"Antigo\" \"Novo\"`");

    const oldName = match[2] || match[3] || match[4] || match[5];
    const newName = match[7] || match[8] || match[9] || match[10];

    const oc = await OCModel.findOne({ adminId: userId, name: oldName });
    if (!oc) return message.reply("OC não encontrado.");

    oc.name = newName;
    await oc.save();
    return message.reply(`✅ Renomeado para **${newName}**.`);
}