import {
    Message,
    MessageCollector,
    TextChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    EmbedBuilder
} from "discord.js";
import { OCModel } from "../../../tools/models/OCSchema";
import { extractName } from "../utils";
import { parseWikiText } from "../../../tools/utils/reading";

export default async function handleWiki(message: Message | any, args: string[], userId: string) {
    const subAction = args[1]?.toLowerCase();
    const validSubs = ["add", "edit", "remove", "extra", "ref", "intro", "bio", "emoji"];

    if (validSubs.includes(subAction)) {
        const extracted = extractName(message.content, subAction);
        if (!extracted) return message.reply(`⚠️ Uso: \`rp!oc wiki ${subAction} "NomeOC" [Argumentos]\``);

        const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
        if (!oc) return message.reply("❌ OC não encontrado ou você não é o dono.");

        if (subAction === "add") {
            const titleMatch = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
            if (!titleMatch) return message.reply("⚠️ Uso: `rp!oc wiki add \"NomeOC\" \"Título da Seção\"`");
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
                    if (!oc.wiki) oc.wiki = { bio: "", extras: new Map(), sections: [], references: [] };

                    const extractedRefs = parseWikiText(contentStr.trim());

                    oc.wiki.sections.push({ title: sectionTitle, content: contentStr.trim() });

                    extractedRefs.forEach((ref: string) => {
                        if (!oc.wiki.references.includes(ref)) oc.wiki.references.push(ref);
                    });

                    oc.markModified('wiki');
                    await oc.save();
                    message.channel.send(`✅ Seção **${sectionTitle}** adicionada à Wiki de ${oc.name}!`);
                }
            });
            return;
        }

        if (subAction === "extra") {
            const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))$/);
            if (!match) return message.reply("⚠️ Uso: `rp!oc wiki extra \"NomeOC\" \"Característica\" \"Valor\"`");

            const key = match[2] || match[3] || match[4] || match[5];
            const val = match[7] || match[8] || match[9] || match[10];

            if (!oc.wiki) oc.wiki = { bio: "", extras: new Map(), sections: [], references: [] };

            if (val.toLowerCase() === "remove") {
                oc.wiki.extras.delete(key);
                await oc.save();
                return message.reply(`🗑️ Extra **${key}** removido.`);
            }

            oc.wiki.extras.set(key, val);
            await oc.save();
            return message.reply(`✅ Extra salvo: **${key}** = ${val}`);
        }

        if (subAction === "emoji") {
            const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+(.+)$/);
            if (!match) return message.reply("⚠️ Uso: `rp!oc wiki emoji \"NomeOC\" \"Título da Seção\" ☄️`");

            const sectionTitle = match[2] || match[3] || match[4] || match[5];
            const newEmoji = match[6].trim();

            if (!oc.wiki || !oc.wiki.sections) return message.reply("Essa Wiki ainda não tem seções.");

            const sectionIndex = oc.wiki.sections.findIndex((s: any) => s.title.toLowerCase() === sectionTitle.toLowerCase());
            if (sectionIndex === -1) return message.reply(`❌ Seção **"${sectionTitle}"** não encontrada no sumário.`);

            oc.wiki.sections[sectionIndex].emoji = newEmoji;

            oc.markModified('wiki');
            await oc.save();

            return message.reply(`✅ Emoji da seção **${sectionTitle}** alterado para ${newEmoji}!`);
        }

        if (subAction === "ref") {
            const refMatch = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
            if (!refMatch) return message.reply("⚠️ Uso: `rp!oc wiki ref \"NomeOC\" \"NomeDaReferencia\"`");
            const refName = refMatch[2] || refMatch[3] || refMatch[4] || refMatch[5];

            if (!oc.wiki) oc.wiki = { bio: "", extras: new Map(), sections: [], references: [] };
            if (oc.wiki.references.includes(refName)) return message.reply("Essa referência já existe!");

            oc.wiki.references.push(refName);
            await oc.save();
            return message.reply(`🔗 Referência **${refName}** adicionada!`);
        }

        if (subAction === "intro" || subAction === "bio") {
            message.reply(`📝 **Escrevendo a Introdução de ${oc.name}**\nDigite o texto principal. O bot dividirá automaticamente em páginas se ficar muito grande. Digite **END** para salvar.`);

            const collector = new MessageCollector(message.channel as TextChannel, { filter: (m: Message) => m.author.id === userId, time: 300000 });
            let introStr = "";

            collector.on('collect', (m: Message) => {
                const text = m.content.trim();

                if (text.toUpperCase() === "END") {
                    collector.stop("finished");
                }
                else if (text.toUpperCase().endsWith("END")) {
                    const cleanText = text.substring(0, text.length - 3).trim();
                    if (cleanText) introStr += cleanText + "\n";
                    collector.stop("finished");
                }
                else {
                    introStr += text + "\n";
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === "finished") {
                    if (!oc.wiki) {
                        oc.wiki = { bio: "", extras: new Map(), sections: [], references: [] };
                    }

                    const extractedRefs = parseWikiText(introStr.trim());

                    oc.set('wiki.bio', introStr.trim());

                    extractedRefs.forEach((ref: string) => {
                        if (!oc.wiki.references.includes(ref)) {
                            oc.wiki.references.push(ref);
                        }
                    });

                    oc.markModified('wiki');
                    await oc.save();
                    message.channel.send(`✅ Introdução de **${oc.name}** atualizada!`);
                }
            });

            return;
        }

        if (subAction === "edit") {
            const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
            if (!match) return message.reply("⚠️ Uso: `rp!oc wiki edit \"NomeOC\" \"Título da Seção\"`");

            const sectionTitle = match[2] || match[3] || match[4] || match[5];

            if (!oc.wiki || !oc.wiki.sections) return message.reply("Essa Wiki ainda não tem seções.");

            const sectionIndex = oc.wiki.sections.findIndex((s: any) => s.title.toLowerCase() === sectionTitle.toLowerCase());
            if (sectionIndex === -1) return message.reply(`❌ Seção **"${sectionTitle}"** não encontrada no sumário.`);

            message.reply(`✏️ **Editando a seção "${oc.wiki.sections[sectionIndex].title}"**\nEnvie o novo texto completo. Digite **END** para salvar.`);

            const collector = new MessageCollector(message.channel as TextChannel, { filter: (m: Message) => m.author.id === userId, time: 300000 });
            let newContent = "";

            collector.on('collect', (m: Message) => {
                if (m.content.trim() === "END") collector.stop("finished");
                else newContent += m.content + "\n";
            });

            collector.on('end', async (_, reason) => {
                if (reason === "finished") {
                    oc.wiki.sections[sectionIndex].content = newContent.trim();
                    await oc.save();
                    message.channel.send(`✅ Seção **${oc.wiki.sections[sectionIndex].title}** atualizada com sucesso!`);
                }
            });
            return;
        }

        if (subAction === "remove") {
            const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
            if (!match) return message.reply("⚠️ Uso: `rp!oc wiki remove \"NomeOC\" \"Título da Secção\"`");

            const sectionTitle = match[2] || match[3] || match[4] || match[5];

            if (!oc.wiki || !oc.wiki.sections || oc.wiki.sections.length === 0) {
                return message.reply("Essa Wiki ainda não tem secções para remover.");
            }

            const sectionIndex = oc.wiki.sections.findIndex((s: any) => s.title.toLowerCase() === sectionTitle.toLowerCase());
            if (sectionIndex === -1) return message.reply(`❌ Secção **"${sectionTitle}"** não encontrada no sumário.`);

            const removedTitle = oc.wiki.sections[sectionIndex].title;

            oc.wiki.sections.splice(sectionIndex, 1);

            oc.markModified('wiki');
            await oc.save();

            return message.reply(`🗑️ Secção **${removedTitle}** removida com sucesso da Wiki de ${oc.name}!`);
        }
    }

    const extracted = extractName(message.content, "wiki");
    if (!extracted) return message.reply("De quem é a Wiki? `rp!oc wiki \"Nome\"`");

    const generateWikiView = async (targetName: string, sectionIndex: number = -1, pageIndex: number = 0): Promise<{ embeds: EmbedBuilder[], components: ActionRowBuilder<any>[], currentTarget: string } | null> => {
        const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const t = await OCModel.findOne({ name: { $regex: new RegExp(`^${escapeRegex(targetName)}$`, 'i') } });
        if (!t) return null;

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setAuthor({ name: `Wiki: ${t.name}`, iconURL: t.avatar })
            .setThumbnail(t.avatar);

        const components: ActionRowBuilder<any>[] = [];

        if (sectionIndex === -1) {
            let ownerName = `<@${t.adminId}>`;
            try {
                const user = await message.client.users.fetch(t.adminId);
                ownerName = `${user.username}`;
            } catch (e) { }

            const bday = t.realBirthday ? `${t.realBirthday.getDate()}/${t.realBirthday.getMonth() + 1}` : "???";
            const created = t.createdAt ? t.createdAt.toLocaleDateString('pt-BR') : "???";

            let desc = `**👑 Dono:** ${ownerName} | **📅 Criado:** ${created}\n`;
            desc += `**🎂 Niver:** ${bday} | **💬 Msgs:** ${t.messageCount}\n`;
            desc += `**🤖 IA:** ${t.ai.enabled ? "ON" : "OFF"} | **📂 Grupo:** ${t.group || "Nenhum"}\n\n`;

            embed.setDescription(desc);

            if (t.wiki?.extras && t.wiki.extras.size > 0) {
                for (let [key, val] of t.wiki.extras.entries()) {
                    embed.addFields({ name: key, value: val as string, inline: true });
                }
            }

            if (t.wiki?.bio) {
                let chunks: string[] = [];
                let textStr = t.wiki.bio;

                while (textStr.length > 0) {
                    if (textStr.length <= 1000) {
                        chunks.push(textStr);
                        break;
                    }
                    let sliceIndex = textStr.lastIndexOf(' ', 1000);
                    if (sliceIndex === -1) sliceIndex = 1000;
                    chunks.push(textStr.substring(0, sliceIndex).trim());
                    textStr = textStr.substring(sliceIndex).trim();
                }

                const currentText = chunks[pageIndex] || chunks[0];
                const pageIndicator = chunks.length > 1 ? ` *(Pág. ${pageIndex + 1}/${chunks.length})*` : "";

                embed.addFields({ name: `📝 Introdução${pageIndicator}`, value: currentText, inline: false });

                if (chunks.length > 1) {
                    components.push(new ActionRowBuilder<any>().addComponents(
                        new ButtonBuilder().setCustomId(`page_prev_${sectionIndex}_${pageIndex}`).setLabel('⬅️ Voltar').setStyle(ButtonStyle.Secondary).setDisabled(pageIndex === 0),
                        new ButtonBuilder().setCustomId(`page_next_${sectionIndex}_${pageIndex}`).setLabel('Avançar ➡️').setStyle(ButtonStyle.Secondary).setDisabled(pageIndex === chunks.length - 1)
                    ));
                }
            }

            if ((!t.wiki?.extras || t.wiki.extras.size === 0) && !t.wiki?.bio) {
                embed.addFields({ name: "Ficheiro", value: "*Nenhum detalhe extra ou introdução adicionados.*", inline: false });
            }
        }
        else {
            const section = t.wiki.sections[sectionIndex];

            let chunks: string[] = [];
            let textStr = section.content;

            while (textStr.length > 0) {
                if (textStr.length <= 1000) {
                    chunks.push(textStr);
                    break;
                }
                let sliceIndex = textStr.lastIndexOf(' ', 1000);
                if (sliceIndex === -1) sliceIndex = 1000;
                chunks.push(textStr.substring(0, sliceIndex).trim());
                textStr = textStr.substring(sliceIndex).trim();
            }

            const currentText = chunks[pageIndex] || chunks[0];
            const pageIndicator = chunks.length > 1 ? ` (Pág. ${pageIndex + 1}/${chunks.length})` : "";

            embed.setTitle(`📖 Tópico: ${section.title}${pageIndicator}`);
            embed.setDescription(currentText);

            if (chunks.length > 1) {
                components.push(new ActionRowBuilder<any>().addComponents(
                    new ButtonBuilder().setCustomId(`page_prev_${sectionIndex}_${pageIndex}`).setLabel('⬅️ Voltar').setStyle(ButtonStyle.Secondary).setDisabled(pageIndex === 0),
                    new ButtonBuilder().setCustomId(`page_next_${sectionIndex}_${pageIndex}`).setLabel('Avançar ➡️').setStyle(ButtonStyle.Secondary).setDisabled(pageIndex === chunks.length - 1)
                ));
            }
        }

        if (t.wiki?.sections && t.wiki.sections.length > 0) {
            const sectionMenu = new StringSelectMenuBuilder()
                .setCustomId('wiki_section')
                .setPlaceholder('📚 Saiba Mais');

            sectionMenu.addOptions(
                new StringSelectMenuOptionBuilder().setLabel('🏠 Ficheiro Principal').setValue('-1').setEmoji('🏠')
            );

            t.wiki.sections.forEach((sec: any, idx: number) => {
                sectionMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(sec.title.substring(0, 100))
                        .setValue(idx.toString())
                        .setEmoji(sec.emoji || '📄')
                );
            });

            components.push(new ActionRowBuilder<any>().addComponents(sectionMenu));
        }

        if (t.wiki?.references && t.wiki.references.length > 0) {
            const refMenu = new StringSelectMenuBuilder()
                .setCustomId('wiki_ref')
                .setPlaceholder('🔗 Personagens Citados...');

            t.wiki.references.forEach((ref: string) => {
                refMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(ref.substring(0, 100))
                        .setValue(ref)
                        .setEmoji('👥')
                );
            });

            components.push(new ActionRowBuilder<any>().addComponents(refMenu));
        }

        return { embeds: [embed], components, currentTarget: t.name };
    };

    let currentWikiData = await generateWikiView(extracted.name);
    if (!currentWikiData) return message.reply("❌ OC não encontrado na rede.");

    const msg = await message.channel.send({
        embeds: currentWikiData.embeds,
        components: currentWikiData.components
    });

    const collector = msg.createMessageComponentCollector({
        time: 300000
    });

    collector.on('collect', async (i: any) => {
        if (i.isStringSelectMenu()) {
            if (i.customId === 'wiki_section') {
                const selectedIndex = parseInt(i.values[0]);
                const newData = await generateWikiView(currentWikiData!.currentTarget, selectedIndex, 0);
                if (newData) await i.update({ embeds: newData.embeds, components: newData.components });
            }

            if (i.customId === 'wiki_ref') {
                const referencedName = i.values[0];
                const newData = await generateWikiView(referencedName, -1, 0);

                if (newData) {
                    currentWikiData = newData;
                    await i.update({ embeds: newData.embeds, components: newData.components });
                } else {
                    await i.reply({ content: `❌ A Wiki de **${referencedName}** não foi encontrada no banco de dados.`, ephemeral: true });
                }
            }
        }

        if (i.isButton()) {
            if (i.customId.startsWith('page_prev_') || i.customId.startsWith('page_next_')) {
                const parts = i.customId.split('_');
                const action = parts[1];
                const secIdx = parseInt(parts[2]);
                const currPage = parseInt(parts[3]);

                const targetPage = action === 'prev' ? currPage - 1 : currPage + 1;

                const newData = await generateWikiView(currentWikiData!.currentTarget, secIdx, targetPage);
                if (newData) await i.update({ embeds: newData.embeds, components: newData.components });
            }
        }
    });

    collector.on('end', () => {
        msg.edit({ components: [] }).catch(() => { });
    });
}