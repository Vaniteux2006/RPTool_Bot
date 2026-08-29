import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleGroup(message: Message, args: string[], userId: string) {
    const subAction = args[1]?.toLowerCase();
    
    if (subAction === "create") {
        const extracted = extractName(message.content, "create");
        if (!extracted || !extracted.rest) return message.reply(`⚠️ Uso: \`rp!oc group create "NomeOC" "NomeGrupo"\``);

        const ocName = extracted.name;
        const groupMatch = extracted.rest.match(/^("([^"]+)"|'([^']+)'|([^\s]+))/);
        if (!groupMatch) return message.reply("⚠️ Faltou o nome do grupo.");
        const groupName = groupMatch[2] || groupMatch[3] || groupMatch[4];

        // Um grupo só existe enquanto algum OC o referencia — impede "recriar" um grupo já existente.
        const exists = await OCModel.countDocuments({ adminId: userId, group: groupName });
        if (exists > 0) return message.reply(`⚠️ O grupo **${groupName}** já existe. Use \`rp!oc group add "NomeOC" "${groupName}"\` pra adicionar mais OCs.`);

        const updated = await OCModel.findOneAndUpdate({ adminId: userId, name: ocName }, { group: groupName });
        if (updated) return message.reply(`📁 Grupo **${groupName}** criado com **${ocName}** dentro.`);
        return message.reply(`❌ OC **${ocName}** não encontrado.`);
    }

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

    if (subAction === "list") {
        // Pega o que vem depois de "rp!oc group list" (nome de grupo opcional, com ou sem aspas)
        const rawArg = message.content.replace(/^rp!oc\s+group\s+list\s*/i, "").trim();
        const argMatch = rawArg.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(.+))$/s);
        const filterGroup = argMatch ? (argMatch[2] || argMatch[3] || argMatch[4] || argMatch[5]).trim() : null;

        // Lista os OCs de um grupo específico
        if (filterGroup) {
            const ocs = await OCModel.find({ adminId: userId, group: filterGroup }).sort({ name: 1 });
            if (ocs.length === 0) return message.reply(`❌ Nenhum OC encontrado no grupo **${filterGroup}**.`);

            const listStr = ocs.map(t => `> 🗣️ **${t.name}** — \`${t.prefix}text${t.suffix}\` | 💬 ${t.messageCount}`).join("\n");
            return message.reply({
                embeds: [{
                    title: `📂 Grupo: ${filterGroup}`,
                    description: listStr,
                    color: 0xFFFF00,
                    footer: { text: `${ocs.length} OC(s) neste grupo` },
                    thumbnail: { url: ocs[0]?.avatar }
                }]
            });
        }

        // Lista todos os grupos do usuário com seus membros
        const ocs = await OCModel.find({ adminId: userId, group: { $ne: null } }).sort({ group: 1, name: 1 });
        if (ocs.length === 0) return message.reply("📭 Você ainda não tem nenhum grupo. Crie um com `rp!oc group add \"NomeOC\" \"NomeGrupo\"`.");

        const groups = new Map<string, string[]>();
        for (const oc of ocs) {
            const g = oc.group as string;
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g)!.push(oc.name);
        }

        const listStr = [...groups.entries()].map(([g, names]) => {
            const preview = names.slice(0, 10).join(", ");
            const extra = names.length > 10 ? ` *(+${names.length - 10})*` : "";
            return `**📂 ${g}** — ${names.length} OC(s)\n> ${preview}${extra}`;
        }).join("\n\n");

        return message.reply({
            embeds: [{
                title: `🗂️ Seus Grupos (${groups.size})`,
                description: listStr,
                color: 0xFFFF00,
                footer: { text: `${groups.size} grupo(s) • ${ocs.length} OC(s) agrupados` }
            }]
        });
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

    return message.reply("⚠️ Subcomandos de grupo: `create`, `add`, `remove`, `delete`, `list`.");
}