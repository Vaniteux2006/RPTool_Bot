// RPTool/supercommands/oc/wiki/gallery.ts
import { Message } from "discord.js";
import { OCModel, WikiModel } from "../../../tools/models/OCSchema";
import { extractName } from "../utils";

export default async function handleGallery(message: Message, args: string[], userId: string) {
    const isUndo = ["undo", "remove"].includes(args[2]?.toLowerCase()) || ["undo", "remove"].includes(args[3]?.toLowerCase());

    const subAction = args[1]?.toLowerCase() || "gallery";
    const extracted = extractName(message.content, subAction);
    if (!extracted) return message.reply('⚠️ Uso: `rp!oc wiki gallery ["undo"] "NomeOC" ["Categoria"] ["Página"]`');

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado ou você não é o dono.");

    let restText = extracted.rest.trim();
    restText = restText.replace(/^(undo|remove)\s+/i, "").trim();

    let category = "Geral";
    let page: number | null = null;

    if (restText) {
        const catMatch = restText.match(/^["'`](.+?)["'`]/);
        if (catMatch) {
            category = catMatch[1];
            const remaining = restText.substring(catMatch[0].length).trim();
            const pageMatch = remaining.match(/^["'`]?(\d+)["'`]?$/);
            if (pageMatch) page = parseInt(pageMatch[1]);
        } else {
            if (/^\d+$/.test(restText)) {
                page = parseInt(restText);
            } else {
                category = restText;
            }
        }
    }

    let wiki = await WikiModel.findOne({ ocId: oc._id });
    if (!wiki) wiki = new WikiModel({ ocId: oc._id, adminId: userId, bio: "", extras: new Map(), sections: [], references: [], gallery: [] });

    let catIndex = wiki.gallery.findIndex((g: any) => g.category.toLowerCase() === category.toLowerCase());

    if (isUndo) {
        if (catIndex === -1) return message.reply(`❌ A categoria **${category}** não existe na galeria.`);
        
        let tempImages = [...wiki.gallery[catIndex].images]; 

        if (page !== null && page > 0) {
            const realIndex = page - 1;
            if (!tempImages[realIndex]) {
                return message.reply(`⚠️ Não há imagens na página **${page}** da categoria **${category}**.`);
            }
            tempImages[realIndex] = ""; 
            wiki.gallery[catIndex].images = tempImages; 
            
            wiki.markModified('gallery');
            await wiki.save();
            return message.reply(`🗑️ Imagens da página **${page}** (Categoria: ${category}) removidas com sucesso!`);
        } else {
            return message.reply("⚠️ Para remover, você precisa especificar o número da página. Ex: `rp!oc wiki gallery undo \"Personagem\" \"Categoria\" 2`.");
        }
    }

    const attachment = message.attachments.first();
    if (!attachment || !attachment.contentType?.startsWith('image/')) {
        return message.reply("❌ Você precisa anexar uma imagem para adicionar à galeria!");
    }

    const imageUrl = attachment.url;

    if (catIndex === -1) {
        wiki.gallery.push({ category, images: [] });
        catIndex = wiki.gallery.length - 1;
    }

    let tempImages = [...wiki.gallery[catIndex].images];

    if (page !== null && page > 0) {
        const realIndex = page - 1;
        while (tempImages.length <= realIndex) {
            tempImages.push("");
        }

        if (tempImages[realIndex] && tempImages[realIndex] !== "") {
            const currentUrls = tempImages[realIndex].split(',');
            if (currentUrls.length >= 2) {
                return message.reply("❌ Esta página já atingiu o limite de 2 imagens! Remova as atuais ou use outra página.");
            }
            tempImages[realIndex] = tempImages[realIndex] + `,${imageUrl}`;
        } else {
            tempImages[realIndex] = imageUrl;
        }
    } else {
        const firstEmptyIndex = tempImages.findIndex((img: string) => img === "");
        if (firstEmptyIndex !== -1) {
            tempImages[firstEmptyIndex] = imageUrl;
        } else {
            tempImages.push(imageUrl);
        }
    }

    wiki.gallery[catIndex].images = tempImages; 
    wiki.markModified('gallery');
    await wiki.save();
    return message.reply(`✅ Imagem adicionada à galeria **${category}** (Página: ${page || 1})!`);
}