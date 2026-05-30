// RPTool/supercommands/oc/wiki/edit.ts
import { Message, MessageCollector, TextChannel } from "discord.js";
import { OCModel, WikiModel } from "../../../tools/models/OCSchema";
import { extractName } from "../utils";

export default async function handleWikiEdit(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, "edit");
    if (!extracted) return message.reply('⚠️ Uso: `rp!oc wiki edit "NomeOC" "Título da Seção"`');

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    const wiki = await WikiModel.findOne({ ocId: oc._id });
    if (!wiki || !wiki.sections || wiki.sections.length === 0) return message.reply("Essa Wiki não tem seções.");

    const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
    if (!match) return message.reply('⚠️ Uso: `rp!oc wiki edit "NomeOC" "Título da Seção"`');
    
    const sectionTitle = match[2] || match[3] || match[4] || match[5];
    const sectionIndex = wiki.sections.findIndex((s: any) => s.title.toLowerCase() === sectionTitle.toLowerCase());
    if (sectionIndex === -1) return message.reply(`❌ Seção **"${sectionTitle}"** não encontrada.`);

    message.reply(`✏️ **Editando "${wiki.sections[sectionIndex].title}"**\nEnvie o novo texto. Digite **END** para salvar.`);

    const collector = new MessageCollector(message.channel as TextChannel, { filter: (m: Message) => m.author.id === userId, time: 300000 });
    let newContent = "";

    collector.on('collect', (m: Message) => {
        if (m.content.trim() === "END") collector.stop("finished");
        else newContent += m.content + "\n";
    });

    collector.on('end', async (_, reason) => {
        if (reason === "finished") {
            wiki.sections[sectionIndex].content = newContent.trim();
            wiki.markModified('sections');
            await wiki.save();
            message.reply(`✅ Secção atualizada com sucesso!`);
        }
    });
}