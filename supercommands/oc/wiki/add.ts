// RPTool/supercommands/oc/wiki/add.ts
import { Message, MessageCollector, TextChannel } from "discord.js";
import { OCModel, WikiModel } from "../../../tools/models/OCSchema";
import { extractName } from "../utils";
import { parseWikiText } from "../../../tools/utils/reading";

export default async function handleAdd(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, "add");
    if (!extracted) return message.reply('⚠️ Uso: `rp!oc wiki add "NomeOC" "Título da Seção"`');

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado ou você não é o dono.");

    const titleMatch = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
    if (!titleMatch) return message.reply('⚠️ Uso: `rp!oc wiki add "NomeOC" "Título da Seção"`');
    
    const sectionTitle = titleMatch[2] || titleMatch[3] || titleMatch[4] || titleMatch[5];

    message.reply(`📖 **Enviando Lore para a seção "${sectionTitle}"**\nDigite o texto. Digite **END** em uma nova mensagem para salvar.`);

    const collector = new MessageCollector(message.channel as TextChannel, { filter: (m: Message) => m.author.id === userId, time: 300000 });
    let contentStr = "";

    collector.on('collect', (m: Message) => {
        if (m.content.trim() === "END") collector.stop("finished");
        else contentStr += m.content + "\n";
    });

    collector.on('end', async (_, reason) => {
        if (reason === "finished") {
            let wiki = await WikiModel.findOne({ ocId: oc._id });
            if (!wiki) wiki = new WikiModel({ ocId: oc._id, adminId: userId, bio: "", extras: new Map(), sections: [], references: [], gallery: [] });

            const extractedRefs = parseWikiText(contentStr.trim());
            wiki.sections.push({ title: sectionTitle, content: contentStr.trim() });

            extractedRefs.forEach((ref: string) => {
                if (!wiki.references.includes(ref)) wiki.references.push(ref);
            });

            wiki.markModified('sections');
            await wiki.save();
            message.reply(`✅ Seção **${sectionTitle}** adicionada à Wiki de ${oc.name}!`);
        }
    });
}