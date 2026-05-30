import { Message } from "discord.js";
import handleAdd from "./add";
import handleEdit from "./edit";
import handleRemove from "./remove";
import handleExtra from "./extra";
import handleEmoji from "./emoji";
import handleRef from "./ref";
import handleIntro from "./intro";
import handleView from "./view";
import handleGallery from "./gallery"; // ⬅️ NOVA IMPORTAÇÃO

export default async function handleWikiMain(message: Message | any, args: string[], userId: string) {
    const subAction = args[1]?.toLowerCase();
    // Adicionei gallery e galery nas opções válidas
    const validSubs = ["add", "edit", "remove", "extra", "ref", "intro", "bio", "emoji", "gallery", "galery"];

    if (validSubs.includes(subAction)) {
        switch (subAction) {
            case "add": return handleAdd(message, args, userId);
            case "edit": return handleEdit(message, args, userId);
            case "remove": return handleRemove(message, args, userId);
            case "extra": return handleExtra(message, args, userId);
            case "ref": return handleRef(message, args, userId);
            case "intro":
            case "bio": return handleIntro(message, args, userId);
            case "emoji": return handleEmoji(message, args, userId);
            case "gallery": 
            case "galery": return handleGallery(message, args, userId); // ⬅️ CHAMA A GALERIA
        }
    }

    // Se não for uma subação, tenta visualizar a Wiki
    return handleView(message, args, userId);
}