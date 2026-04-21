// RPTool/supercommands/oc/wiki/remove.ts
import { Message } from "discord.js";
import { OCModel, WikiModel } from "../../../tools/models/OCSchema";
import { extractName } from "../utils";

export default async function handleRemove(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, "remove");
    if (!extracted) return message.reply('⚠️ Uso: `rp!oc wiki remove "NomeOC" "Título da Seção"`');

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado ou você não é o dono.");

    const wiki = await WikiModel.findOne({ ocId: oc._id });
    if (!wiki || !wiki.sections || wiki.sections.length === 0) return message.reply("Essa Wiki ainda não tem secções para remover.");

    const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
    if (!match) return message.reply('⚠️ Uso: `rp!oc wiki remove "NomeOC" "Título da Secção"`');
    
    const sectionTitle = match[2] || match[3] || match[4] || match[5];

    const sectionIndex = wiki.sections.findIndex((s: any) => s.title.toLowerCase() === sectionTitle.toLowerCase());
    if (sectionIndex === -1) return message.reply(`❌ Secção **"${sectionTitle}"** não encontrada no sumário.`);

    const removedTitle = wiki.sections[sectionIndex].title;
    wiki.sections.splice(sectionIndex, 1);
    
    wiki.markModified('sections');
    await wiki.save();
    
    return message.reply(`🗑️ Secção **${removedTitle}** removida com sucesso da Wiki de ${oc.name}!`);
}