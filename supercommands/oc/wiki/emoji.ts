// RPTool/supercommands/oc/wiki/emoji.ts
import { Message } from "discord.js";
import { OCModel, WikiModel } from "../../../tools/models/OCSchema";
import { extractName } from "../utils";

export default async function handleEmoji(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, "emoji");
    if (!extracted) return message.reply('⚠️ Uso: `rp!oc wiki emoji "NomeOC" "Título da Seção" ☄️`');

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado ou você não é o dono.");

    const wiki = await WikiModel.findOne({ ocId: oc._id });
    if (!wiki || !wiki.sections) return message.reply("Essa Wiki ainda não tem seções.");

    const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+(.+)$/);
    if (!match) return message.reply('⚠️ Uso: `rp!oc wiki emoji "NomeOC" "Título da Seção" ☄️`');

    const sectionTitle = match[2] || match[3] || match[4] || match[5];
    const newEmoji = match[6].trim();

    const sectionIndex = wiki.sections.findIndex((s: any) => s.title.toLowerCase() === sectionTitle.toLowerCase());
    if (sectionIndex === -1) return message.reply(`❌ Seção **"${sectionTitle}"** não encontrada no sumário.`);

    wiki.sections[sectionIndex].emoji = newEmoji;
    wiki.markModified('sections');
    await wiki.save();

    return message.reply(`✅ Emoji da seção **${sectionTitle}** alterado para ${newEmoji}!`);
}