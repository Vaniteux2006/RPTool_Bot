// RPTool/supercommands/oc/wiki/extra.ts
import { Message } from "discord.js";
import { OCModel, WikiModel } from "../../../tools/models/OCSchema";
import { extractName } from "../utils";

export default async function handleExtra(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, "extra");
    if (!extracted) return message.reply('⚠️ Uso: `rp!oc wiki extra "NomeOC" "Característica" "Valor"`');

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado ou você não é o dono.");

    const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))$/);
    if (!match) return message.reply('⚠️ Uso: `rp!oc wiki extra "NomeOC" "Característica" "Valor"`');

    const key = match[2] || match[3] || match[4] || match[5];
    const val = match[7] || match[8] || match[9] || match[10];

    let wiki = await WikiModel.findOne({ ocId: oc._id });
    if (!wiki) wiki = new WikiModel({ ocId: oc._id, adminId: userId, bio: "", extras: new Map(), sections: [], references: [], gallery: [] });

    if (val.toLowerCase() === "remove") {
        wiki.extras.delete(key);
        await wiki.save();
        return message.reply(`🗑️ Extra **${key}** removido.`);
    }

    wiki.extras.set(key, val);
    await wiki.save();
    return message.reply(`✅ Extra salvo: **${key}** = ${val}`);
}