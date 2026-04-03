// RPTool/supercommands/oc/wiki/intro.ts
import { Message, MessageCollector, TextChannel } from "discord.js";
import { OCModel, WikiModel } from "../../../tools/models/OCSchema";
import { extractName } from "../utils";
import { parseWikiText } from "../../../tools/utils/reading";

export default async function handleIntro(message: Message, args: string[], userId: string) {
    const subAction = args[1]?.toLowerCase();
    const extracted = extractName(message.content, subAction);
    if (!extracted) return message.reply(`⚠️ Uso: \`rp!oc wiki ${subAction} "NomeOC"\``);

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado ou você não é o dono.");

    message.reply(`📝 **Escrevendo a Introdução de ${oc.name}**\nDigite o texto principal. O bot dividirá automaticamente em páginas se ficar muito grande. Digite **END** para salvar.`);

    const collector = new MessageCollector(message.channel as TextChannel, { filter: (m: Message) => m.author.id === userId, time: 300000 });
    let introStr = "";

    collector.on('collect', (m: Message) => {
        const text = m.content.trim();

        if (text.toUpperCase() === "END") {
            collector.stop("finished");
        } else if (text.toUpperCase().endsWith("END")) {
            const cleanText = text.substring(0, text.length - 3).trim();
            if (cleanText) introStr += cleanText + "\n";
            collector.stop("finished");
        } else {
            introStr += text + "\n";
        }
    });

    collector.on('end', async (_, reason) => {
        if (reason === "finished") {
            let wiki = await WikiModel.findOne({ ocId: oc._id });
            if (!wiki) wiki = new WikiModel({ ocId: oc._id, adminId: userId, bio: "", extras: new Map(), sections: [], references: [], gallery: [] });

            const extractedRefs = parseWikiText(introStr.trim());
            wiki.bio = introStr.trim();

            extractedRefs.forEach((ref: string) => {
                if (!wiki.references.includes(ref)) {
                    wiki.references.push(ref);
                }
            });

            await wiki.save();
            message.reply(`✅ Introdução de **${oc.name}** atualizada!`);
        }
    });
}