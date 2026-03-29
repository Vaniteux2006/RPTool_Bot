import { Message, TextChannel, MessageCollector } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleWiki(message: Message, args: string[], userId: string) {
    const subAction = args[1]?.toLowerCase();
    const validSubs = ["add", "edit", "remove", "extra", "ref", "intro", "bio", "emoji"];

    if (!validSubs.includes(subAction)) {
        return message.reply("⚠️ Uso: `rp!oc wiki <add|edit|remove|extra|ref|intro|emoji> \"NomeOC\"`");
    }

    const extracted = extractName(message.content, subAction);
    if (!extracted) return message.reply(`⚠️ Faltou o nome do OC. Uso: \`rp!oc wiki ${subAction} "NomeOC"\``);

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    // Garante que o objeto wiki existe para não dar crash
    if (!oc.wiki) {
        oc.wiki = { bio: "", extras: new Map(), sections: [], references: [] };
    }

    // 📝 1. Lógica para INTRO / BIO
    if (subAction === "intro" || subAction === "bio") {
        message.reply(`📝 **Escrevendo a Introdução de ${oc.name}**\nDigite o texto principal abaixo. Quando terminar, digite **END** em uma nova mensagem para salvar.`);
        const collector = new MessageCollector(message.channel as TextChannel, { filter: m => m.author.id === userId, time: 300000 });
        let newContent = "";

        collector.on('collect', m => {
            if (m.content.trim() === "END") collector.stop("finished");
            else newContent += m.content + "\n";
        });

        collector.on('end', async (_, reason) => {
            if (reason === "finished") {
                oc.wiki.bio = newContent.trim();
                oc.markModified('wiki');
                await oc.save();
                message.reply(`✅ Biografia de **${oc.name}** atualizada com sucesso!`);
            } else {
                message.reply("⏳ Tempo esgotado para escrever a bio.");
            }
        });
        return;
    }

    // ➕ 2. Lógica para ADD (Adicionar seção)
    if (subAction === "add") {
        const titleMatch = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
        if (!titleMatch) return message.reply("⚠️ Uso: `rp!oc wiki add \"NomeOC\" \"Título da Seção\"`");
        const sectionTitle = titleMatch[2] || titleMatch[3] || titleMatch[4] || titleMatch[5];

        message.reply(`📖 **Enviando Lore para a seção "${sectionTitle}"**\nDigite o texto. Digite **END** em uma nova mensagem para salvar.`);
        const collector = new MessageCollector(message.channel as TextChannel, { filter: m => m.author.id === userId, time: 300000 });
        let newContent = "";

        collector.on('collect', m => {
            if (m.content.trim() === "END") collector.stop("finished");
            else newContent += m.content + "\n";
        });

        collector.on('end', async (_, reason) => {
            if (reason === "finished") {
                oc.wiki.sections.push({ title: sectionTitle, content: newContent.trim(), emoji: "📄" });
                oc.markModified('wiki');
                await oc.save();
                message.reply(`✅ Seção **${sectionTitle}** criada com sucesso!`);
            }
        });
        return;
    }

    // ☄️ 3. Lógica para EMOJI
    if (subAction === "emoji") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+(.+)$/);
        if (!match) return message.reply("⚠️ Uso: `rp!oc wiki emoji \"NomeOC\" \"Título da Seção\" ☄️`");
        const sectionTitle = match[2] || match[3] || match[4] || match[5];
        const newEmoji = match[6].trim();

        if (!oc.wiki.sections || oc.wiki.sections.length === 0) return message.reply("Essa Wiki ainda não tem seções criadas.");

        const sectionIndex = oc.wiki.sections.findIndex((s: any) => s.title.toLowerCase() === sectionTitle.toLowerCase());
        if (sectionIndex === -1) return message.reply(`❌ Seção **"${sectionTitle}"** não encontrada no sumário.`);

        oc.wiki.sections[sectionIndex].emoji = newEmoji;
        oc.markModified('wiki');
        await oc.save();
        return message.reply(`✅ Emoji da seção **${sectionTitle}** alterado para ${newEmoji}!`);
    }

    // ✏️ 4. Lógica para EDIT (Editar seção)
    if (subAction === "edit") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
        if (!match) return message.reply("⚠️ Uso: `rp!oc wiki edit \"NomeOC\" \"Título da Seção\"`");
        const sectionTitle = match[2] || match[3] || match[4] || match[5];

        const sectionIndex = oc.wiki.sections.findIndex((s: any) => s.title.toLowerCase() === sectionTitle.toLowerCase());
        if (sectionIndex === -1) return message.reply(`❌ Seção **"${sectionTitle}"** não encontrada.`);

        message.reply(`✏️ **Editando a seção "${sectionTitle}"**\nDigite o novo texto e envie **END** para salvar.`);
        const collector = new MessageCollector(message.channel as TextChannel, { filter: m => m.author.id === userId, time: 300000 });
        let newContent = "";

        collector.on('collect', m => {
            if (m.content.trim() === "END") collector.stop("finished");
            else newContent += m.content + "\n";
        });

        collector.on('end', async (_, reason) => {
            if (reason === "finished") {
                oc.wiki.sections[sectionIndex].content = newContent.trim();
                oc.markModified('wiki');
                await oc.save();
                message.reply(`✅ Seção **${sectionTitle}** atualizada com sucesso!`);
            }
        });
        return;
    }

    // 🗑️ 5. Lógica para REMOVE (Remover seção)
    if (subAction === "remove") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
        if (!match) return message.reply("⚠️ Uso: `rp!oc wiki remove \"NomeOC\" \"Título da Seção\"`");
        const sectionTitle = match[2] || match[3] || match[4] || match[5];

        const initialLength = oc.wiki.sections.length;
        oc.wiki.sections = oc.wiki.sections.filter((s: any) => s.title.toLowerCase() !== sectionTitle.toLowerCase());

        if (oc.wiki.sections.length === initialLength) {
            return message.reply(`❌ Seção **"${sectionTitle}"** não encontrada.`);
        }

        oc.markModified('wiki');
        await oc.save();
        return message.reply(`🗑️ Seção **${sectionTitle}** deletada.`);
    }

    // 🏷️ 6. Lógica para EXTRA (Campos Curtos como Idade, Raça, etc)
    if (subAction === "extra") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+(.+)$/);
        if (!match) return message.reply("⚠️ Uso: `rp!oc wiki extra \"NomeOC\" \"Chave\" \"Valor\"` (Ex: rp!oc wiki extra \"Zeca\" \"Idade\" \"25 anos\")\nPara remover: `... \"Chave\" remove`");

        const key = match[2] || match[3] || match[4] || match[5];
        const valueMatch = match[6].match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(.+))/);
        const value = valueMatch ? (valueMatch[2] || valueMatch[3] || valueMatch[4] || valueMatch[5]) : match[6];

        if (!oc.wiki.extras) oc.wiki.extras = new Map();

        if (value.toLowerCase() === "remove") {
            oc.wiki.extras.delete(key);
            message.reply(`🗑️ Extra **${key}** removido.`);
        } else {
            oc.wiki.extras.set(key, value);
            message.reply(`✅ Extra **${key}** definido como: ${value}`);
        }

        oc.markModified('wiki');
        await oc.save();
        return;
    }

    // 🔗 7. Lógica para REF (Referência de Links cruzados)
    if (subAction === "ref") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
        if (!match) return message.reply("⚠️ Uso: `rp!oc wiki ref \"NomeOC\" \"NomeDaReferencia\"`");
        const refName = match[2] || match[3] || match[4] || match[5];

        if (!oc.wiki.references) oc.wiki.references = [];

        if (oc.wiki.references.includes(refName)) {
            // Remove se já existir (Toggle)
            oc.wiki.references = oc.wiki.references.filter((r: string) => r !== refName);
            message.reply(`🗑️ Referência a **${refName}** removida.`);
        } else {
            oc.wiki.references.push(refName);
            message.reply(`🔗 Referência a **${refName}** adicionada!`);
        }

        oc.markModified('wiki');
        await oc.save();
        return;
    }
}