// RPTool/supercommands/oc/wiki/emoji.ts
import { Message } from "discord.js";
import { OCModel, WikiModel } from "../../../tools/models/OCSchema";
import { CUSTOM_EMOJI_RE, sanitizeEmoji } from "../../../tools/utils/economy";
import { extractName } from "../utils";

export default async function handleEmoji(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, "emoji");
    if (!extracted) return message.reply('⚠️ Uso: `rp!oc wiki emoji "NomeOC" "Título da Seção" ☄️` (emoji padrão ou custom do servidor).');

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado ou você não é o dono.");

    const wiki = await WikiModel.findOne({ ocId: oc._id });
    if (!wiki || !wiki.sections) return message.reply("Essa Wiki ainda não tem seções.");

    const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+(.+)$/);
    if (!match) return message.reply('⚠️ Uso: `rp!oc wiki emoji "NomeOC" "Título da Seção" ☄️`');

    const sectionTitle = match[2] || match[3] || match[4] || match[5];
    const newEmoji = match[6].trim();

    // O emoji vai num SELECT MENU (componente) — string inválida ou emoji que o
    // bot não pode usar derrubaria a wiki INTEIRA (Invalid Form Body). Então a
    // validação é aqui, na entrada:
    //   • custom (<:nome:id>): precisa ser de um servidor onde o BOT está;
    //   • senão: tem que parecer um emoji unicode de verdade.
    const customId = newEmoji.match(CUSTOM_EMOJI_RE)?.[1];
    if (customId && !message.client.emojis.cache.has(customId)) {
        return message.reply('❌ Esse emoji é de um servidor onde eu **não estou** — no menu da wiki ele quebraria. Use um emoji deste servidor (ou um padrão).');
    }
    if (!customId && (/\s/.test(newEmoji) || !/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(newEmoji))) {
        return message.reply('⚠️ Isso não parece um emoji (só um, sem texto junto). Use um padrão (☄️) ou um custom do servidor.');
    }

    const sectionIndex = wiki.sections.findIndex((s: any) => s.title.toLowerCase() === sectionTitle.toLowerCase());
    if (sectionIndex === -1) return message.reply(`❌ Seção **"${sectionTitle}"** não encontrada no sumário.`);

    wiki.sections[sectionIndex].emoji = sanitizeEmoji(newEmoji, '📄');
    wiki.markModified('sections');
    await wiki.save();

    return message.reply(`✅ Emoji da seção **${sectionTitle}** alterado para ${newEmoji}!`);
}