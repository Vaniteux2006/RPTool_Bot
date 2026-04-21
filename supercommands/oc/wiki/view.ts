// RPTool/supercommands/oc/wiki/view.ts
import { Message, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } from "discord.js";
import { OCModel, WikiModel } from "../../../tools/models/OCSchema";
import { extractName } from "../utils";

export default async function handleView(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, "wiki");
    if (!extracted) return message.reply('De quem é a Wiki? `rp!oc wiki "Nome"`');

    const generateWikiView = async (targetName: string, mode: "main" | "section" | "gallery" = "main", index: number = 0, pageIndex: number = 0): Promise<{ embeds: EmbedBuilder[], components: ActionRowBuilder<any>[], currentTarget: string } | null> => {
        const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const t = await OCModel.findOne({ name: { $regex: new RegExp(`^${escapeRegex(targetName)}$`, 'i') } });
        if (!t) return null;

        const wiki = await WikiModel.findOne({ ocId: t._id }); // ⬅️ Busca a Wiki aqui

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setAuthor({ name: `Wiki: ${t.name}`, iconURL: t.avatar })
            .setThumbnail(t.avatar);

        const components: ActionRowBuilder<any>[] = [];
        let extraEmbeds: EmbedBuilder[] = [];

        if (mode === "main") {
            let ownerName = `<@${t.adminId}>`;
            try {
                const user = await message.client.users.fetch(t.adminId);
                ownerName = `${user.username}`;
            } catch (e) { }

            const bday = t.realBirthday ? `${t.realBirthday.getDate()}/${t.realBirthday.getMonth() + 1}` : "???";
            const created = t.createdAt ? t.createdAt.toLocaleDateString('pt-BR') : "???";

            let desc = `**👑 Dono:** ${ownerName} | **📅 Criado:** ${created}\n`;
            desc += `**🎂 Niver:** ${bday} | **💬 Msgs:** ${t.messageCount}\n`;
            desc += `**🤖 IA:** ${t.ai?.enabled ? "ON" : "OFF"} | **📂 Grupo:** ${t.group || "Nenhum"}\n\n`;

            embed.setDescription(desc);

            if (wiki?.extras && wiki.extras.size > 0) {
                for (let [key, val] of wiki.extras.entries()) {
                    embed.addFields({ name: key, value: val as string, inline: true });
                }
            }

            if (wiki?.bio) {
                let chunks: string[] = [];
                let textStr = wiki.bio;
                while (textStr.length > 0) {
                    if (textStr.length <= 1000) { chunks.push(textStr); break; }
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
                        new ButtonBuilder().setCustomId(`page_prev_main_0_${pageIndex}`).setLabel('⬅️ Voltar').setStyle(ButtonStyle.Secondary).setDisabled(pageIndex === 0),
                        new ButtonBuilder().setCustomId(`page_next_main_0_${pageIndex}`).setLabel('Avançar ➡️').setStyle(ButtonStyle.Secondary).setDisabled(pageIndex === chunks.length - 1)
                    ));
                }
            } else if ((!wiki?.extras || wiki.extras.size === 0)) {
                embed.addFields({ name: "Ficheiro", value: "*Nenhum detalhe extra ou introdução adicionados.*", inline: false });
            }
        } 
        
        else if (mode === "section") {
            const section = wiki!.sections[index];
            let chunks: string[] = [];
            let textStr = section.content;

            while (textStr.length > 0) {
                if (textStr.length <= 1000) { chunks.push(textStr); break; }
                let sliceIndex = textStr.lastIndexOf(' ', 1000);
                if (sliceIndex === -1) sliceIndex = 1000;
                chunks.push(textStr.substring(0, sliceIndex).trim());
                textStr = textStr.substring(sliceIndex).trim();
            }

            const currentText = chunks[pageIndex] || chunks[0];
            const pageIndicator = chunks.length > 1 ? ` (Pág. ${pageIndex + 1}/${chunks.length})` : "";

            embed.setTitle(`📖 Tópico: ${section.title}${pageIndicator}`);
            embed.setDescription(currentText);
            embed.setThumbnail(null); 

            if (wiki?.gallery) {
                const matchingGallery = wiki.gallery.find((g: any) => g.category.toLowerCase() === section.title.toLowerCase());
                if (matchingGallery && matchingGallery.images.length > 0) {
                    const imageForThisPage = matchingGallery.images[pageIndex];
                    if (imageForThisPage && imageForThisPage.trim() !== "") {
                        const urls = imageForThisPage.split(',');
                        embed.setImage(urls[0]);

                        if (urls.length > 1) {
                            const gridUrl = "https://discord.com"; 
                            embed.setURL(gridUrl); 
                            
                            const secondEmbed = new EmbedBuilder()
                                .setURL(gridUrl) 
                                .setImage(urls[1]);
                            extraEmbeds.push(secondEmbed);
                        }
                    }
                }
            }

            if (chunks.length > 1) {
                components.push(new ActionRowBuilder<any>().addComponents(
                    new ButtonBuilder().setCustomId(`page_prev_section_${index}_${pageIndex}`).setLabel('⬅️ Voltar').setStyle(ButtonStyle.Secondary).setDisabled(pageIndex === 0),
                    new ButtonBuilder().setCustomId(`page_next_section_${index}_${pageIndex}`).setLabel('Avançar ➡️').setStyle(ButtonStyle.Secondary).setDisabled(pageIndex === chunks.length - 1)
                ));
            }
        }

        else if (mode === "gallery") {
            const categoryObj = wiki!.gallery[index];
            const images = categoryObj.images.flatMap((img: string) => img.split(',')).filter((img: string) => img !== ""); 
            
            if (images.length === 0) {
                embed.setTitle(`🖼️ Galeria: ${categoryObj.category}`);
                embed.setDescription("*Nenhuma imagem válida encontrada.*");
            } else {
                const safePageIndex = pageIndex >= images.length ? images.length - 1 : pageIndex;
                const currentImageUrl = images[safePageIndex] || images[0];
                
                embed.setTitle(`🖼️ Galeria: ${categoryObj.category} (${safePageIndex + 1}/${images.length})`);
                
                const isTopic = wiki!.sections?.some((s: any) => s.title.toLowerCase() === categoryObj.category.toLowerCase());
                if (isTopic) {
                    embed.setDescription(`*Tópico: ${categoryObj.category}*`);
                }

                embed.setImage(currentImageUrl);
                embed.setThumbnail(null); 

                if (images.length > 1) {
                    components.push(new ActionRowBuilder<any>().addComponents(
                        new ButtonBuilder().setCustomId(`page_prev_gallery_${index}_${safePageIndex}`).setLabel('⬅️ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(safePageIndex === 0),
                        new ButtonBuilder().setCustomId(`page_next_gallery_${index}_${safePageIndex}`).setLabel('Próxima ➡️').setStyle(ButtonStyle.Secondary).setDisabled(safePageIndex === images.length - 1)
                    ));
                }
            }

            if (wiki!.gallery.length > 1) {
                const catMenu = new StringSelectMenuBuilder()
                    .setCustomId('wiki_gallery_cat')
                    .setPlaceholder('📂 Ver outra Categoria da Galeria...');
                
                wiki!.gallery.forEach((cat: any, idx: number) => {
                    const cleanImages = cat.images.flatMap((img: string) => img.split(',')).filter((img: string) => img !== "");
                    if (cleanImages.length > 0) {
                        catMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(cat.category).setValue(`gallery_${idx}`).setEmoji('📁'));
                    }
                });
                if (catMenu.options.length > 0) components.push(new ActionRowBuilder<any>().addComponents(catMenu));
            }
        }

        const sectionMenu = new StringSelectMenuBuilder()
            .setCustomId('wiki_section')
            .setPlaceholder('📚 Saiba Mais');

        sectionMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel('🏠 Ficheiro Principal').setValue('main_0').setEmoji('🏠'));

        if (wiki?.gallery && wiki.gallery.some((g: any) => g.images.some((img:string) => img !== ""))) {
            sectionMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel('🖼️ Galeria de Imagens').setValue('gallery_0').setEmoji('🖼️'));
        }

        if (wiki?.sections && wiki.sections.length > 0) {
            wiki.sections.forEach((sec: any, idx: number) => {
                sectionMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(sec.title.substring(0, 100)).setValue(`section_${idx}`).setEmoji(sec.emoji || '📄'));
            });
        }
        
        components.unshift(new ActionRowBuilder<any>().addComponents(sectionMenu));

        if (wiki?.references && wiki.references.length > 0) {
            const refMenu = new StringSelectMenuBuilder()
                .setCustomId('wiki_ref')
                .setPlaceholder('🔗 Personagens Citados...');

            wiki.references.forEach((ref: string) => {
                refMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(ref.substring(0, 100)).setValue(ref).setEmoji('👥'));
            });
            components.push(new ActionRowBuilder<any>().addComponents(refMenu));
        }

        return { embeds: [embed, ...extraEmbeds], components, currentTarget: t.name };
    };

    let currentWikiData = await generateWikiView(extracted.name);
    if (!currentWikiData) return message.reply("❌ OC não encontrado na rede.");

    const msg = await message.reply({ embeds: currentWikiData.embeds, components: currentWikiData.components });
    const collector = msg.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i: any) => {
        if (i.isStringSelectMenu()) {
            if (i.customId === 'wiki_section' || i.customId === 'wiki_gallery_cat') {
                const parts = i.values[0].split('_');
                const targetMode = parts[0] as "main" | "section" | "gallery";
                const targetIdx = parseInt(parts[1]);
                
                const newData = await generateWikiView(currentWikiData!.currentTarget, targetMode, targetIdx, 0);
                if (newData) await i.update({ embeds: newData.embeds, components: newData.components });
            }

            if (i.customId === 'wiki_ref') {
                const referencedName = i.values[0];
                const newData = await generateWikiView(referencedName, "main", 0, 0);

                if (newData) {
                    currentWikiData = newData;
                    await i.update({ embeds: newData.embeds, components: newData.components });
                } else {
                    await i.reply({ content: `❌ A Wiki de **${referencedName}** não foi encontrada no banco de dados.`, ephemeral: true });
                }
            }
        }

        if (i.isButton()) {
            if (i.customId.startsWith('page_')) {
                const parts = i.customId.split('_');
                const action = parts[1];
                const mode = parts[2] as "main" | "section" | "gallery";
                const idx = parseInt(parts[3]);
                const currPage = parseInt(parts[4]);

                const targetPage = action === 'prev' ? currPage - 1 : currPage + 1;

                const newData = await generateWikiView(currentWikiData!.currentTarget, mode, idx, targetPage);
                if (newData) await i.update({ embeds: newData.embeds, components: newData.components });
            }
        }
    });

    collector.on('end', () => { msg.edit({ components: [] }).catch(() => { }); });
}