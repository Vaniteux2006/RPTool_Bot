import { 
    Message, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ComponentType
} from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';
import { readLongText } from '../../../tools/utils/reading'; 

export default async function handleWiki(message: Message, args: string[], userId: string) {
    const subAction = args[1]?.toLowerCase();
    const validSubs = ["add", "edit", "remove", "extra", "ref", "intro", "bio", "emoji"];

    // 📖 MODO LEITURA
    if (!subAction || !validSubs.includes(subAction)) {
        const extracted = extractName(message.content, "wiki");
        if (!extracted) return message.reply("⚠️ Uso: `rp!oc wiki \"NomeOC\"` para ver, ou `rp!oc wiki <add|edit|remove|extra|ref> \"NomeOC\"`");

        let targetId = userId;
        if (message.mentions.users.first()) {
            targetId = message.mentions.users.first()!.id;
        }

        const oc = await OCModel.findOne({
            $or: [{ adminId: targetId }, { duoIds: targetId }],
            name: extracted.name
        });

        if (!oc) return message.reply("❌ OC não encontrado.");

        if (!oc.wiki || (oc.wiki.sections.length === 0 && !oc.wiki.bio && (!oc.wiki.extras || oc.wiki.extras.size === 0) && (!oc.wiki.references || oc.wiki.references.length === 0))) {
            return message.reply(`📭 **${oc.name}** ainda não possui uma página na Wiki. Use \`rp!oc wiki bio "${oc.name}"\` para começar!`);
        }

        const mainEmbed = new EmbedBuilder()
            .setTitle(`📚 Wiki: ${oc.name}`)
            .setColor(0x2B2D31)
            .setThumbnail(oc.avatar);

        let desc = oc.wiki.bio ? `**Introdução**\n${oc.wiki.bio}\n\n` : "";
        
        if (oc.wiki.extras && oc.wiki.extras.size > 0) {
            desc += "**Ficha Rápida**\n";
            for (const [k, v] of oc.wiki.extras.entries()) {
                desc += `> **${k}:** ${v}\n`;
            }
            desc += "\n";
        }
        mainEmbed.setDescription(desc || "Nenhuma introdução definida.");

        if (oc.wiki.references && oc.wiki.references.length > 0) {
            mainEmbed.addFields({ name: "🔗 Ligações", value: oc.wiki.references.join(", ") });
        }

        if (!oc.wiki.sections || oc.wiki.sections.length === 0) {
            return message.reply({ embeds: [mainEmbed] });
        }

        const options = [
            new StringSelectMenuOptionBuilder()
                .setLabel('Página Principal')
                .setValue('main')
                .setEmoji('🏠')
                .setDescription('Voltar para a introdução')
        ];

        oc.wiki.sections.forEach((sec, idx) => {
            options.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(sec.title.substring(0, 100))
                    .setValue(`sec_${idx}`)
                    .setEmoji(sec.emoji || '📄')
            );
        });

        const select = new StringSelectMenuBuilder()
            .setCustomId('wiki_select')
            .setPlaceholder('Navegue pelas páginas...')
            .addOptions(options);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

        const msg = await message.reply({ embeds: [mainEmbed], components: [row] });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 120000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: "Só quem abriu a wiki pode navegar nela.", ephemeral: true });
            }

            const val = i.values[0];
            if (val === 'main') {
                await i.update({ embeds: [mainEmbed] });
            } else {
                const idx = parseInt(val.split('_')[1]);
                const sec = oc.wiki.sections[idx];
                if (sec) {
                    const secEmbed = new EmbedBuilder()
                        .setTitle(`${sec.emoji || '📄'} ${oc.name} - ${sec.title}`)
                        .setDescription(sec.content)
                        .setColor(0x2B2D31)
                        .setThumbnail(oc.avatar);
                    await i.update({ embeds: [secEmbed] });
                }
            }
        });

        collector.on('end', () => {
            msg.edit({ components: [] }).catch(() => {});
        });

        return;
    }

    // ✏️ MODO EDIÇÃO
    const extracted = extractName(message.content, subAction);
    if (!extracted) return message.reply(`⚠️ Faltou o nome do OC. Uso: \`rp!oc wiki ${subAction} "NomeOC"\``);

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    if (!oc.wiki) oc.wiki = { bio: "", extras: new Map(), sections: [], references: [] };

    // 1. INTRO / BIO (Atualizado com readLongText)
    if (subAction === "intro" || subAction === "bio") {
        await message.reply(`📝 **Escrevendo a Introdução de ${oc.name}**\nEnvie a sua história em quantas mensagens quiser. Quando terminar, digite **END** (ou **CANCELAR** para abortar). Tem 5 minutos.`);
        
        const bioText = await readLongText(message, userId);
        if (!bioText) return; // Sai silenciosamente, o readLongText já avisa se cancelar ou esgotar tempo

        oc.wiki.bio = bioText;
        oc.markModified('wiki');
        await oc.save();
        return message.reply(`✅ Introdução de **${oc.name}** salva!`);
    }

    // 2. EXTRA
    if (subAction === "extra") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+(.*)$/);
        if (!match) return message.reply("⚠️ Uso: `rp!oc wiki extra \"NomeOC\" \"Característica\" Valor`\nEx: `rp!oc wiki extra \"Zane\" \"Idade\" 25 anos`");
        const key = match[2] || match[3] || match[4] || match[5];
        const value = match[6];

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

    // 3. REF
    if (subAction === "ref") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
        if (!match) return message.reply("⚠️ Uso: `rp!oc wiki ref \"NomeOC\" \"NomeDaReferencia\"`");
        const refName = match[2] || match[3] || match[4] || match[5];

        if (!oc.wiki.references) oc.wiki.references = [];

        if (oc.wiki.references.includes(refName)) {
            oc.wiki.references = oc.wiki.references.filter(r => r !== refName);
            message.reply(`🔗 Referência **${refName}** removida de ${oc.name}.`);
        } else {
            oc.wiki.references.push(refName);
            message.reply(`🔗 Referência **${refName}** adicionada!`);
        }
        oc.markModified('wiki');
        await oc.save();
        return;
    }

    // 4. ADD / EDIT (Atualizado com readLongText)
    if (subAction === "add" || subAction === "edit") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s*(.*)$/si);
        if (!match) return message.reply(`⚠️ Uso: \`rp!oc wiki ${subAction} "NomeOC" "Título da Seção" [Conteúdo]\``);

        const title = match[2] || match[3] || match[4] || match[5];
        const content = match[6]?.trim();

        const saveSection = async (ocToSave: any, secTitle: string, secContent: string) => {
            const idx = ocToSave.wiki.sections.findIndex((s: any) => s.title.toLowerCase() === secTitle.toLowerCase());
            if (idx >= 0) {
                ocToSave.wiki.sections[idx].content = secContent;
                message.reply(`✅ Seção **${secTitle}** atualizada.`);
            } else {
                ocToSave.wiki.sections.push({ title: secTitle, content: secContent });
                message.reply(`✅ Seção **${secTitle}** criada.`);
            }
            ocToSave.markModified('wiki');
            await ocToSave.save();
        };

        if (!content) {
            await message.reply(`📝 **${subAction === 'add' ? 'Nova Seção' : 'Editando'} -> ${title}**\nEnvie o conteúdo em quantas mensagens quiser. Quando terminar, digite **END** (ou **CANCELAR** para abortar). Tem 5 minutos.`);
            
            const collectedText = await readLongText(message, userId);
            if (!collectedText) return; 

            await saveSection(oc, title, collectedText);
        } else {
            // Se o utilizador já enviou o texto logo à frente do comando
            await saveSection(oc, title, content);
        }
        return;
    }

    // 5. REMOVE
    if (subAction === "remove") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
        if (!match) return message.reply("⚠️ Uso: `rp!oc wiki remove \"NomeOC\" \"Título da Seção\"`");
        const title = match[2] || match[3] || match[4] || match[5];

        const initialLength = oc.wiki.sections.length;
        oc.wiki.sections = oc.wiki.sections.filter((s: any) => s.title.toLowerCase() !== title.toLowerCase());

        if (oc.wiki.sections.length === initialLength) return message.reply(`❌ Seção **${title}** não encontrada.`);
        
        oc.markModified('wiki');
        await oc.save();
        return message.reply(`🗑️ Seção **${title}** removida.`);
    }

    // 6. EMOJI
    if (subAction === "emoji") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+(\S+)$/);
        if (!match) return message.reply("⚠️ Uso: `rp!oc wiki emoji \"NomeOC\" \"Título da Seção\" 🌟`");
        const title = match[2] || match[3] || match[4] || match[5];
        const emoji = match[6];

        const sec = oc.wiki.sections.find((s: any) => s.title.toLowerCase() === title.toLowerCase());
        if (!sec) return message.reply(`❌ Seção **${title}** não encontrada.`);

        sec.emoji = emoji;
        oc.markModified('wiki');
        await oc.save();
        return message.reply(`✅ Emoji da seção **${title}** alterado para ${emoji}.`);
    }
}