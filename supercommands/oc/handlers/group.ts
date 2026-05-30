import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleGroup(message: Message, args: string[], userId: string) {
    const subAction = args[1]?.toLowerCase();
    
    if (subAction === "add") {
        const extracted = extractName(message.content, "add");
        if (!extracted || !extracted.rest) return message.reply(`⚠️ Uso: \`rp!oc group add "NomeOC" "NomeGrupo"\``);
        
        const ocName = extracted.name;
        const groupMatch = extracted.rest.match(/^("([^"]+)"|'([^']+)'|([^\s]+))/);
        if (!groupMatch) return message.reply("⚠️ Faltou o nome do grupo.");
        const groupName = groupMatch[2] || groupMatch[3] || groupMatch[4];

        const updated = await OCModel.findOneAndUpdate({ adminId: userId, name: ocName }, { group: groupName });
        if (updated) return message.reply(`📂 **${ocName}** adicionado ao grupo **${groupName}**.`);
        return message.reply(`❌ OC **${ocName}** não encontrado.`);
    }

    if (subAction === "remove") {
        const extracted = extractName(message.content, "remove");
        if (!extracted) return message.reply(`⚠️ Uso: \`rp!oc group remove "NomeOC"\``);

        const updated = await OCModel.findOneAndUpdate({ adminId: userId, name: extracted.name }, { group: null });
        if (updated) return message.reply(`🌧️ **${extracted.name}** saiu do grupo.`);
        return message.reply(`❌ OC não encontrado.`);
    }

    if (subAction === "delete") {
        const extracted = extractName(message.content, "delete");
        if (!extracted) return message.reply(`⚠️ Uso: \`rp!oc group delete "NomeDoGrupo"\``);
        
        const groupName = extracted.name;
        const result = await OCModel.updateMany({ adminId: userId, group: groupName }, { $set: { group: null } });
        
        if (result.modifiedCount > 0) {
            return message.reply(`🗑️ Grupo **${groupName}** dissolvido. ${result.modifiedCount} OCs sem grupo agora.`);
        } else {
            return message.reply(`❌ Nenhum OC encontrado no grupo **${groupName}**.`);
        }
    }

    return message.reply("⚠️ Subcomandos de grupo: `add`, `remove`, `delete`.");
}