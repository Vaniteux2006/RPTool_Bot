// RPTool/supercommands/oc/wiki/ref.ts
import { Message } from "discord.js";
import { OCModel, WikiModel } from "../../../tools/models/OCSchema";
import { extractName } from "../utils";

export default async function handleRef(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, "ref");
    if (!extracted) return message.reply('⚠️ Uso: `rp!oc wiki ref "NomeOC" "NomeDaReferencia"`');

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado ou você não é o dono.");

    const refMatch = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
    if (!refMatch) return message.reply('⚠️ Uso: `rp!oc wiki ref "NomeOC" "NomeDaReferencia"`');
    
    const refName = refMatch[2] || refMatch[3] || refMatch[4] || refMatch[5];

    let wiki = await WikiModel.findOne({ ocId: oc._id });
    if (!wiki) wiki = new WikiModel({ ocId: oc._id, adminId: userId, bio: "", extras: new Map(), sections: [], references: [], gallery: [] });

    if (wiki.references.includes(refName)) return message.reply("Essa referência já existe!");

    wiki.references.push(refName);
    await wiki.save();
    return message.reply(`🔗 Referência **${refName}** adicionada!`);
}