import {
    Message,
    MessageCollector,
    TextChannel,
    AttachmentBuilder,
    Webhook,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    EmbedBuilder,
    ModalBuilder, 
    TextInputBuilder,
    TextInputStyle 
} from "discord.js";
import { Command } from "../interfaces/Command";
import { OCModel } from "../models/OCSchema"; 
import { getGuildAIConfig } from './utils/tokenHelper'; 
import axios from 'axios';

const extractName = (content: string, commandName: string) => {
    const cmdIndex = content.toLowerCase().indexOf(commandName.toLowerCase());
    if (cmdIndex === -1) return null;

    const rawArgs = content.slice(cmdIndex + commandName.length).trim();
    const match = rawArgs.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))(\s+(.+))?$/);

    if (!match) return null;

    return {
        name: match[2] || match[3] || match[4] || match[5],
        rest: match[7]?.trim() || ""
    };
};

const cleanWrapper = (str: string) => {
    if ((str.startsWith('`') && str.endsWith('`')) ||
        (str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
        return str.slice(1, -1);
    }
    return str;
};

const parseWikiText = (rawText: string) => {
    const extractedRefs: string[] = [];
    
    const cleanText = rawText.replace(/\(ref="([^"]+)"\)/g, (match, refName) => {
        if (!extractedRefs.includes(refName)) {
            extractedRefs.push(refName);
        }
        return `**__${refName}__**`; 
    });

    return { cleanText, extractedRefs };
};

export const command: Command = {
    name: "oc",
    description: "Gerencia seus OCs (Personagens)",
    aliases: ["tul", "tupper", "char", "t"],
    execute: async (message: Message | any, args: string[]) => {

        if (!args[0]) {
            return message.reply(`
**Comandos do RPTool OC:**
\`create, list, delete, avatar, prefix, name, edit\`
\`wiki (add, extra, ref, edit)\`
\`ai, persona, memories, gaslight, forget, insert, end\`
\`group, duo, solo, import, export, purge, birthday\`
Use \`rp!help oc\` para detalhes.
            `);
        }

        const action = args[0].toLowerCase();
        const userId = message.author.id;

        try {
            switch (action) {

                case "create": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted || !extracted.rest) return message.reply("⚠️ Uso: `rp!oc create \"Nome\" prefixo:text`");

                    const { name, rest } = extracted;

                    const attachment = message.attachments.first();
                    let patternRaw = rest;

                    const urlInText = args.find(a => a.startsWith("http"));
                    if (urlInText) patternRaw = patternRaw.replace(urlInText, "").trim();

                    const avatarUrl = attachment ? attachment.url : urlInText;
                    if (!avatarUrl) return message.reply("❌ Erro: Precisa de imagem (anexo ou link).");

                    if (!patternRaw.includes("text")) return message.reply("⚠️ O padrão precisa ter **`text`**. Ex: `nome:text`");

                    const parts = patternRaw.split("text");
                    const prefix = cleanWrapper(parts[0].trim());
                    const suffix = cleanWrapper(parts.slice(1).join("text").trim());

                    const exists = await OCModel.findOne({ adminId: userId, name: name });
                    if (exists) return message.reply("❌ Já existe um OC com esse nome!");

                    await OCModel.create({
                        adminId: userId, name, prefix, suffix, avatar: avatarUrl, createdAt: new Date()
                    });

                    let msg = `✅ OC **${name}** criado!\nExemplo: \`${prefix}Oi${suffix}\``;
                    return message.reply(msg);
                }

                case "delete": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual OC? `rp!oc delete \"Nome\"`");

                    const deleted = await OCModel.findOneAndDelete({ adminId: userId, name: extracted.name });
                    if (!deleted) return message.reply("OC não encontrado.");
                    return message.reply(`🗑️ OC **${extracted.name}** deletado.`);
                }

                case "avatar": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual OC? `rp!oc avatar \"Nome\"`");

                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply("OC não encontrado.");

                    const attachment = message.attachments.first();
                    const newAvatar = attachment ? attachment.url : (extracted.rest.startsWith("http") ? extracted.rest : null);

                    if (!newAvatar) return message.reply(`🖼️ Avatar atual de **${oc.name}**: ${oc.avatar}`);

                    oc.avatar = newAvatar;
                    await oc.save();
                    return message.reply("✅ Avatar atualizado!");
                }

                case "name":
                case "rename": {
                    const rawArgs = message.content.slice(message.content.toLowerCase().indexOf(action) + action.length).trim();
                    const match = rawArgs.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))$/);

                    if (!match) return message.reply("Uso: `rp!oc rename \"Antigo\" \"Novo\"`");

                    const oldName = match[2] || match[3] || match[4] || match[5];
                    const newName = match[7] || match[8] || match[9] || match[10];

                    const oc = await OCModel.findOne({ adminId: userId, name: oldName });
                    if (!oc) return message.reply("OC não encontrado.");

                    oc.name = newName;
                    await oc.save();
                    return message.reply(`✅ Renomeado para **${newName}**.`);
                }

                case "prefix":
                case "prefixo": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted || !extracted.rest) return message.reply("Uso: `rp!oc prefix \"Nome\" novo:text`");

                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply(`❌ OC **${extracted.name}** não encontrado.`);

                    if (!extracted.rest.includes("text")) return message.reply("⚠️ Precisa ter **`text`**. Ex: `k!text`");

                    const parts = extracted.rest.split("text");
                    oc.prefix = cleanWrapper(parts[0].trim());
                    oc.suffix = cleanWrapper(parts.slice(1).join("text").trim());

                    await oc.save();
                    return message.reply(`✅ Novo padrão: \`${oc.prefix}Oi${oc.suffix}\``);
                }

                case "list": {
                    let targetId = userId;
                    if (message.mentions.users.first()) {
                        targetId = message.mentions.users.first()!.id;
                    } else if (args[1] && args[1].length > 15) {
                        targetId = args[1];
                    }

                    const query = { $or: [{ adminId: targetId }, { duoIds: targetId }] };
                    const totalDocs = await OCModel.countDocuments(query);
                    if (totalDocs === 0) return message.reply("📭 Nenhum OC encontrado.");

                    const generateEmbed = async (page: number) => {
                        const pageSize = 5; 
                        const skip = (page - 1) * pageSize;

                        const ocs = await OCModel.find(query).skip(skip).limit(pageSize);
                        const totalPages = Math.ceil(totalDocs / pageSize);

                        const listStr = ocs.map(t => {
                            const isOwner = t.adminId === targetId;
                            const icon = isOwner ? "👑" : "🤝";
                            const aiStatus = t.ai.enabled ? "🤖 [IA ON]" : "";

                            const created = t.createdAt ? t.createdAt.toLocaleDateString('pt-BR') : "Desconhecido";
                            const bday = t.realBirthday ? ` | 🎉 ${t.realBirthday.getDate()}/${t.realBirthday.getMonth() + 1}` : "";

                            return `**${icon} ${t.name}** ${aiStatus}\n> 🗣️ **Padrão:** \`${t.prefix}text${t.suffix}\`\n> 💬 **Msgs:** ${t.messageCount}\n> 📂 **Grupo:** ${t.group || "Nenhum"}\n> 📅 **Criado:** ${created}${bday}\n> 🖼️ [Ver Avatar](${t.avatar})`;
                        }).join("\n\n");

                        return {
                            embeds: [{
                                title: `📒 Lista de OCs (${page}/${totalPages})`,
                                description: listStr,
                                color: 0xFFFF00, 
                                footer: { text: `Total de OCs: ${totalDocs}` },
                                thumbnail: { url: ocs[0]?.avatar } 
                            }],
                            totalPages
                        };
                    };

                    let currentPage = 1;
                    const { embeds, totalPages } = await generateEmbed(currentPage);

                    if (totalPages === 1) {
                        return message.channel.send({ embeds });
                    }

                    const row = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('prev_page')
                                .setLabel('⬅️ Anterior')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true), 
                            new ButtonBuilder() 
                                .setCustomId('jump_page')
                                .setLabel('🔢 Pular')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('next_page')
                                .setLabel('Próximo ➡️')
                                .setStyle(ButtonStyle.Primary)
                        );

                    const msg = await message.channel.send({ embeds, components: [row] });

                    const collector = msg.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 60000 
                    });

                    collector.on('collect', async (i) => {
                        if (i.user.id !== userId) {
                            return i.reply({ content: "🚫 Só quem pediu a lista pode mexer.", ephemeral: true });
                        }

                        if (i.customId === 'jump_page') {
                            const modal = new ModalBuilder()
                                .setCustomId('modal_jump_page')
                                .setTitle('Pular para Página');

                            const pageInput = new TextInputBuilder()
                                .setCustomId('page_input')
                                .setLabel(`Digite a página (1 a ${totalPages}):`)
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true);

                            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(pageInput));

                            await i.showModal(modal);

                            try {
                                const modalSubmit = await i.awaitModalSubmit({ 
                                    filter: m => m.user.id === userId && m.customId === 'modal_jump_page', 
                                    time: 60000 
                                });
                                
                                const inputPage = parseInt(modalSubmit.fields.getTextInputValue('page_input'));

                                if (isNaN(inputPage) || inputPage < 1 || inputPage > totalPages) {
                                    return modalSubmit.reply({ content: `❌ Página inválida. Digite um número de 1 a ${totalPages}.`, ephemeral: true });
                                }

                                currentPage = inputPage;
                                const newData = await generateEmbed(currentPage);

                                row.components[0].setDisabled(currentPage === 1);
                                row.components[2].setDisabled(currentPage === totalPages);

                                await modalSubmit.update({ embeds: newData.embeds, components: [row] });
                            } catch (e) {
                            }
                            return; 
                        }

                        if (i.customId === 'prev_page' && currentPage > 1) currentPage--;
                        if (i.customId === 'next_page' && currentPage < totalPages) currentPage++;

                        const newData = await generateEmbed(currentPage);

                        row.components[0].setDisabled(currentPage === 1);
                        row.components[2].setDisabled(currentPage === totalPages);

                        await i.update({ embeds: newData.embeds, components: [row] });
                    });

                    collector.on('end', () => {
                        row.components.forEach(b => b.setDisabled(true));
                        msg.edit({ components: [row] }).catch(() => { });
                    });

                    break;
                }

                case "ai": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual OC? `rp!oc ai \"Nome\"`");

                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply("OC não encontrado.");

                    message.reply(`📝 **Configurando IA para ${oc.name}**\nEnvie a PERSONALIDADE. Digite **END** pra acabar.`);
                    const collector = new MessageCollector(message.channel as TextChannel, { filter: m => m.author.id === userId, time: 300000 });
                    let personaText = "";
                    collector.on('collect', m => {
                        if (m.content.trim() === "END") collector.stop("finished");
                        else personaText += m.content + "\n";
                    });
                    collector.on('end', async (_, reason) => {
                        if (reason === "finished") {
                            oc.ai.enabled = true;
                            oc.ai.persona = personaText;
                            await oc.save();
                            message.channel.send(`🤖 IA Ativada para **${oc.name}**!`);
                        }
                    });
                    break;
                }

                case "insert": {
                    const isAuto = args[1]?.toLowerCase() === "auto";
                    let cleanContent = message.content;
                    if (isAuto) cleanContent = cleanContent.replace(/\bauto\b/i, "").replace(/\s+/, " ");
                    
                    const extracted = extractName(cleanContent, args[0]);
                    if (!extracted) return message.reply("Qual OC? `rp!oc insert [auto] \"Nome\"`");

                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply("OC não encontrado.");
                    if (!oc.ai.enabled) return message.reply("IA não configurada. Usa `rp!oc ai` antes.");

                    oc.ai.activeChannelId = message.channel.id;
                    oc.ai.autoMode = isAuto; 
                    await oc.save();

                    const gatilhoDinamico = `ai:${oc.prefix}${oc.suffix}`.trim();
                    const modoStr = isAuto ? "⚡ **MODO AUTOMÁTICO** (Responde sozinho após silêncio)" : `🖐️ **MODO MANUAL** (Usa o gatilho \`${gatilhoDinamico}\` para o chamar)`;
                    return message.reply(`🤖 **${oc.name}** está a ouvir o canal.\n${modoStr}`);
                }

                case "delay": {
                    const rawArgs = message.content.slice(message.content.toLowerCase().indexOf("delay") + 5).trim();
                    const match = rawArgs.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+(\d+)$/);
                    
                    if (!match) return message.reply("⚠️ Uso: `rp!oc delay \"NomeOC\" 30` (em segundos)");
                    
                    const name = match[2] || match[3] || match[4] || match[5];
                    const secs = parseInt(match[6]);

                    const oc = await OCModel.findOne({ adminId: userId, name: name });
                    if (!oc) return message.reply("OC não encontrado.");

                    oc.ai.replyDelay = secs;
                    await oc.save();
                    
                    return message.reply(`⏱️ O tempo de resposta de **${oc.name}** foi ajustado para **${secs} segundos**.`);
                }

                case "end": {
                    const oc = await OCModel.findOne({ adminId: userId, "ai.activeChannelId": message.channel.id });
                    if (!oc) return message.reply("Nenhum OC seu ativo aqui.");
                    oc.ai.activeChannelId = null;
                    await oc.save();
                    return message.reply(`💤 **${oc.name}** saiu.`);
                }

                case "memories": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual OC?");
                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply("OC não encontrado.");

                    const list = oc.ai.memories.map(m => `🆔 \`${m.id}\`: ${m.content.substring(0, 50)}...`).join("\n");
                    return message.channel.send(`🧠 **Memórias de ${oc.name}:**\n${list || "Vazio."}`);
                }

                case "gaslight": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual OC?");
                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply("OC não encontrado.");

                    message.reply("🧠 **Escreva a memória falsa (END para sair):**");
                    const collector = new MessageCollector(message.channel as TextChannel, { filter: m => m.author.id === userId, time: 60000 });
                    let mem = "";
                    collector.on('collect', m => { if (m.content === "END") collector.stop("done"); else mem += m.content + " "; });
                    collector.on('end', async (_, r) => {
                        if (r === "done") {
                            oc.ai.memories.push({ id: Date.now().toString(36), content: mem });
                            await oc.save();
                            message.channel.send("🧠 Memória implantada.");
                        }
                    });
                    break;
                }

                case "forget": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted || !extracted.rest) return message.reply("Uso: `rp!oc forget \"Nome\" ID_MEMORIA`");

                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply("OC não encontrado.");

                    const initial = oc.ai.memories.length;
                    oc.ai.memories = oc.ai.memories.filter(m => m.id !== extracted.rest);
                    if (oc.ai.memories.length === initial) return message.reply("Memória não achada.");

                    await oc.save();
                    return message.reply("🧠 Esquecido.");
                }

                case "alzheimer": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual OC?");
                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply("OC não encontrado.");

                    oc.ai.memories = [];
                    await oc.save();
                    return message.reply(`🤯 **${oc.name}** esqueceu tudo.`);
                }

                case "puppet": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual OC?");
                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply("OC não encontrado.");

                    oc.ai.enabled = false;
                    oc.ai.activeChannelId = null;
                    await oc.save();
                    return message.reply(`🧵 **${oc.name}** virou fantoche.`);
                }

                case "duo": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual OC?");
                    const targetUser = message.mentions.users.first();
                    if (!targetUser) return message.reply("Marque alguém!");

                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply("Não achado ou sem permissão.");
                    if (oc.ai.enabled) return message.reply("🚫 IA não pode ser Duo.");

                    if (!oc.duoIds.includes(targetUser.id)) {
                        oc.duoIds.push(targetUser.id);
                        await oc.save();
                    }
                    return message.reply(`🤝 **${oc.name}** compartilhado com ${targetUser.username}!`);
                }

                case "solo": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual OC?");
                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply("Não achado ou sem permissão.");

                    oc.duoIds = [];
                    await oc.save();
                    return message.reply(`🔒 **${oc.name}** é só seu agora.`);
                }

                case "birthday": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted || !extracted.rest) return message.reply("Uso: `rp!oc birthday \"Nome\" DD/MM`");

                    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                    if (!oc) return message.reply("OC não encontrado.");

                    const [d, m, y] = extracted.rest.split("/").map(Number);
                    if (!d || !m) return message.reply("Data inválida.");
                    oc.realBirthday = new Date(y || 2000, m - 1, d);
                    await oc.save();
                    return message.reply(`🎂 Aniversário de **${oc.name}** salvo!`);
                }

                case "group": {
                    const sub = args[1]?.toLowerCase();

                    if (!sub) return message.reply("Uso: `list`, `create`, `add`, `remove`, `delete`.");

                    if (sub === "list") {
                        const groups = await OCModel.distinct("group", { adminId: userId });
                        const validGroups = groups.filter(g => g); 
                        if (validGroups.length === 0) return message.reply("Você não tem nenhum grupo.");
                        return message.reply(`📂 **Seus Grupos:**\n${validGroups.join("\n")}`);
                    }

                    if (sub === "create") {
                        const rawArgs = message.content.slice(message.content.toLowerCase().indexOf("create") + 6).trim();
                        const match = rawArgs.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))$/);

                        if (!match) return message.reply("Uso: `rp!oc group create \"Novo Grupo\" \"Nome do OC\"`");

                        const gName = match[2] || match[3] || match[4] || match[5];
                        const tName = match[7] || match[8] || match[9] || match[10];

                        const oc = await OCModel.findOne({ adminId: userId, name: tName });
                        if (!oc) return message.reply(`❌ OC **${tName}** não encontrado.`);

                        oc.group = gName;
                        await oc.save();

                        return message.reply(`✨ Grupo **${gName}** criado e **${oc.name}** adicionado a ele!`);
                    }

                    if (sub === "add") {
                        const rawArgs = message.content.slice(message.content.toLowerCase().indexOf("add") + 3).trim();
                        const match = rawArgs.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))$/);

                        if (!match) return message.reply("Uso: `rp!oc group add \"NomeGrupo\" \"NomeOC\"`");

                        const gName = match[2] || match[3] || match[4] || match[5];
                        const tName = match[7] || match[8] || match[9] || match[10];

                        const groupExists = await OCModel.findOne({ adminId: userId, group: gName });
                        if (!groupExists) return message.reply(`⚠️ O grupo **${gName}** não existe.`);

                        const oc = await OCModel.findOne({ adminId: userId, name: tName });
                        if (!oc) return message.reply(`❌ OC **${tName}** não encontrado.`);

                        oc.group = gName;
                        await oc.save();
                        return message.reply(`📂 **${oc.name}** adicionado ao grupo **${gName}**.`);
                    }

                    if (sub === "remove") {
                        const extracted = extractName(message.content, sub);
                        if (!extracted) return message.reply(`Uso: \`rp!oc group remove "NomeOC"\``);

                        const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
                        if (!oc) return message.reply("OC não encontrado.");

                        const oldGroup = oc.group;
                        if (!oldGroup) return message.reply("Esse OC nem está em grupo.");

                        oc.group = null;
                        await oc.save();

                        return message.reply(`🌧️ **${oc.name}** saiu do grupo **${oldGroup}**.`);
                    }

                    if (sub === "delete") {
                        const extracted = extractName(message.content, sub);
                        if (!extracted) return message.reply(`Uso: \`rp!oc group delete "NomeDoGrupo"\``);

                        const groupName = extracted.name;

                        const members = await OCModel.find({ adminId: userId, group: groupName });

                        if (members.length === 0) return message.reply(`❌ Grupo **${groupName}** não encontrado.`);

                        await OCModel.updateMany(
                            { adminId: userId, group: groupName },
                            { $set: { group: null } }
                        );

                        return message.reply(`🗑️ Grupo **${groupName}** dissolvido. Os ${members.length} membros agora estão sem grupo.`);
                    }

                    return message.reply("Comando inválido.");
                }

                case "find":
                case "info": {
                    const extracted = extractName(message.content, args[0]);
                    const searchTerm = extracted ? extracted.name : args.slice(1).join(" ");

                    if (!searchTerm) return message.reply("Quem você quer achar? `rp!oc find \"Nome\"`");

                    const ocs = await OCModel.find({
                        name: { $regex: searchTerm, $options: "i" }
                    }).limit(5); 

                    if (ocs.length === 0) return message.reply(`❌ Nenhum OC encontrado com **"${searchTerm}"**.`);

                    if (ocs.length > 1) {
                        const list = ocs.map(t => `• **${t.name}** (Dono: <@${t.adminId}>)`).join("\n");
                        return message.reply(`🔍 Encontrei vários:\n${list}\n*Seja mais específico!*`);
                    }

                    const t = ocs[0];

                    let ownerName = `<@${t.adminId}>`;
                    try {
                        const user = await message.client.users.fetch(t.adminId);
                        ownerName = `${user.username} (\`${user.id}\`)`;
                    } catch (e) { }

                    const created = t.createdAt ? t.createdAt.toLocaleDateString('pt-BR') : "Desconhecido";
                    const bday = t.realBirthday ? `${t.realBirthday.getDate()}/${t.realBirthday.getMonth() + 1}` : "Não definido";
                    const aiStatus = t.ai.enabled ? "✅ Ativa" : "❌ Desligada";

                    return message.channel.send({
                        embeds: [{
                            title: `🔎 Ficha de: ${t.name}`,
                            color: 0x00FF00, 
                            thumbnail: { url: t.avatar },
                            fields: [
                                { name: "👑 Dono", value: ownerName, inline: true },
                                { name: "💬 Padrão", value: `\`${t.prefix}text${t.suffix}\``, inline: true },
                                { name: "📊 Mensagens", value: `${t.messageCount}`, inline: true },
                                { name: "📂 Grupo", value: t.group || "Nenhum", inline: true },
                                { name: "📅 Criado em", value: created, inline: true },
                                { name: "🎂 Aniversário", value: bday, inline: true },
                                { name: "🤖 Status IA", value: aiStatus, inline: true },
                            ],
                            image: { url: t.avatar } 
                        }]
                    });
                }

                case "import": {
                    const attachment = message.attachments.first();
                    if (!attachment?.name?.endsWith(".json")) return message.reply("Anexe o arquivo `.json` do Tupperbox/PluralKit.");

                    try {
                        const res = await axios.get(attachment.url);
                        const data = res.data;

                        if (!data.tuppers || !Array.isArray(data.tuppers)) {
                            return message.reply("❌ O arquivo não parece ser um backup válido.");
                        }

                        let count = 0;
                        for (const t of data.tuppers) {
                            const createdAt = t.created_at ? new Date(t.created_at) : new Date();

                            let realBirthday: Date | null = null;
                            if (t.birthday) {
                                const bDate = new Date(t.birthday);
                                if (!isNaN(bDate.getTime())) {
                                    realBirthday = bDate;
                                }
                            }

                            const messageCount = typeof t.posts === 'number' ? t.posts : 0;

                            await OCModel.updateOne(
                                { adminId: userId, name: t.name },
                                {
                                    adminId: userId,
                                    name: t.name,
                                    prefix: Array.isArray(t.brackets) ? t.brackets[0] || "" : "",
                                    suffix: Array.isArray(t.brackets) ? t.brackets[1] || "" : "",
                                    avatar: t.avatar_url || "", 

                                    messageCount: messageCount,
                                    createdAt: createdAt,
                                    realBirthday: realBirthday,

                                },
                                { upsert: true } 
                            );
                            count++;
                        }
                        return message.reply(`📦 **${count}** OCs importados com sucesso!\n✅ Datas, mensagens e aniversários sincronizados.`);
                    } catch (err) {
                        console.error(err);
                        return message.reply("❌ Erro ao processar o arquivo JSON.");
                    }
                }

                case "export": {
                    const ocs = await OCModel.find({ adminId: userId });
                    const json = JSON.stringify({ tuppers: ocs }, null, 2); 
                    const buffer = Buffer.from(json, 'utf-8');
                    const att = new AttachmentBuilder(buffer, { name: 'ocs.json' });
                    return message.reply({ content: "📦 Backup:", files: [att] });
                }

                case "purge": {
                    const dangerEmbed = {
                        title: "⚠️ PERIGO: ZONA DE DESTRUIÇÃO",
                        description: "Você está prestes a **APAGAR TODOS** os seus OCs.\nEssa ação é irreversível.\n\nTem certeza absoluta?",
                        color: 0xFF0000, 
                        footer: { text: "Você tem 15 segundos para decidir." }
                    };

                    const row = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('purge_confirm')
                                .setLabel('🔥 SIM, APAGAR TUDO')
                                .setStyle(ButtonStyle.Danger), 
                            new ButtonBuilder()
                                .setCustomId('purge_cancel')
                                .setLabel('❌ Cancelar')
                                .setStyle(ButtonStyle.Secondary) 
                        );

                    const msg = await message.reply({ embeds: [dangerEmbed], components: [row] });

                    const collector = msg.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 15000 
                    });

                    collector.on('collect', async (i) => {
                        if (i.user.id !== userId) {
                            return i.reply({ content: "🚫 Saia daí! Esse botão não é pra você.", ephemeral: true });
                        }

                        if (i.customId === 'purge_confirm') {
                            await OCModel.deleteMany({ adminId: userId });
                            await i.update({
                                content: "🔥 **KABOOM!** Todos os seus OCs foram transformados em poeira cósmica.",
                                embeds: [],
                                components: []
                            });
                            collector.stop("deleted");
                        } else {
                            await i.update({
                                content: "✅ Operação cancelada. Seus OCs estão salvos.",
                                embeds: [],
                                components: []
                            });
                            collector.stop("cancelled");
                        }
                    });

                    collector.on('end', (_, reason) => {
                        if (reason !== "deleted" && reason !== "cancelled") {
                            const disabledRow = new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(
                                    row.components[0].setDisabled(true),
                                    row.components[1].setDisabled(true)
                                );
                            msg.edit({ content: "⏰ Tempo esgotado.", components: [disabledRow] }).catch(() => { });
                        }
                    });

                    break;
                }

                case "wiki": {
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

                            const collector = new MessageCollector(message.channel as TextChannel, { filter: m => m.author.id === userId, time: 300000 });
                            let contentStr = "";

                            collector.on('collect', m => {
                                if (m.content.trim() === "END") collector.stop("finished");
                                else contentStr += m.content + "\n";
                            });

                            collector.on('end', async (_, reason) => {
                                if (reason === "finished") {
                                    if (!oc.wiki) oc.wiki = { bio: "", extras: new Map(), sections: [], references: [] };
                                    
                                    const parsed = parseWikiText(contentStr.trim());
                                    
                                    oc.wiki.sections.push({ title: sectionTitle, content: parsed.cleanText });
                                    
                                    parsed.extractedRefs.forEach(ref => {
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
                            
                            const sectionIndex = oc.wiki.sections.findIndex(s => s.title.toLowerCase() === sectionTitle.toLowerCase());
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

                            const collector = new MessageCollector(message.channel as TextChannel, { filter: m => m.author.id === userId, time: 300000 });
                            let introStr = "";

                            collector.on('collect', m => {
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
                                    
                                    const parsed = parseWikiText(introStr.trim());
                                    
                                    oc.set('wiki.bio', parsed.cleanText);
                                    
                                    parsed.extractedRefs.forEach(ref => {
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

                            const sectionIndex = oc.wiki.sections.findIndex(s => s.title.toLowerCase() === sectionTitle.toLowerCase());
                            if (sectionIndex === -1) return message.reply(`❌ Seção **"${sectionTitle}"** não encontrada no sumário.`);

                            message.reply(`✏️ **Editando a seção "${oc.wiki.sections[sectionIndex].title}"**\nEnvie o novo texto completo. Digite **END** para salvar.`);

                            const collector = new MessageCollector(message.channel as TextChannel, { filter: m => m.author.id === userId, time: 300000 });
                            let newContent = "";

                            collector.on('collect', m => {
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
                            
                            const sectionIndex = oc.wiki.sections.findIndex(s => s.title.toLowerCase() === sectionTitle.toLowerCase());
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

                    const generateWikiView = async (targetName: string, sectionIndex: number = -1, pageIndex: number = 0) => {
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
                                    embed.addFields({ name: key, value: val, inline: true });
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

                            t.wiki.sections.forEach((sec, idx) => {
                                sectionMenu.addOptions(
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel(sec.title.substring(0, 100))
                                        .setValue(idx.toString())
                                        .setEmoji(sec.emoji || '📄') 
                                );
                            });

                            components.push(new ActionRowBuilder().addComponents(sectionMenu));
                        }

                        if (t.wiki?.references && t.wiki.references.length > 0) {
                            const refMenu = new StringSelectMenuBuilder()
                                .setCustomId('wiki_ref')
                                .setPlaceholder('🔗 Personagens Citados...');

                            t.wiki.references.forEach(ref => {
                                refMenu.addOptions(
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel(ref.substring(0, 100))
                                        .setValue(ref)
                                        .setEmoji('👥')
                                );
                            });

                            components.push(new ActionRowBuilder().addComponents(refMenu));
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

                    collector.on('collect', async (i) => {
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

                    break;
                }

                case "edit": {
                    const newText = args.slice(1).join(" ");
                    if (!newText) return message.reply("Digite o novo texto.");

                    const myOCs = await OCModel.find({ adminId: userId });
                    const myNames = myOCs.map(t => t.name);
                    const msgs = await message.channel.messages.fetch({ limit: 10 });
                    const target = msgs.find(m => m.webhookId && myNames.includes(m.author.username));

                    if (!target) return message.reply("Nenhuma msg recente sua.");
                    const hooks = await (message.channel as TextChannel).fetchWebhooks();
                    const hook = hooks.find(w => w.id === target.webhookId);

                    if (hook) {
                        await hook.editMessage(target.id, { content: newText });
                        message.delete().catch(() => { });
                    } else return message.reply("Erro no webhook.");
                    break;
                }

                default:
                    message.reply("Comando desconhecido.");
            }

        } catch (error) {
            console.error(error);
            message.reply("❌ Erro interno.");
        }
    }
};


const autoTimers = new Map<string, NodeJS.Timeout>();

async function chamarIA(prompt: string, config: any): Promise<string> {
    try {
        if (config.provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
            const body = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            };
            const res = await axios.post(url, body);
            return res.data.candidates[0].content.parts[0].text;
        } 
        else if (config.provider === 'openai') {
            const url = `https://api.openai.com/v1/chat/completions`;
            const body = {
                model: config.model,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            };
            const res = await axios.post(url, body, {
                headers: { 'Authorization': `Bearer ${config.key}` }
            });
            return res.data.choices[0].message.content;
        }
        throw new Error("Provedor de IA não suportado.");
    } catch (error) {
        console.error("❌ Erro na API da IA:", error);
        throw error;
    }
}

export async function handleAIMessage(message: Message): Promise<boolean> {
    if (message.author.bot || message.content.startsWith("rp!")) return false;

    const activeOCs = await OCModel.find({ "ai.enabled": true, "ai.activeChannelId": message.channel.id });
    if (activeOCs.length === 0) return false;

    let triggered = false;

    for (const aiOC of activeOCs) {
        const manualTrigger = `ai:${aiOC.prefix}${aiOC.suffix}`.trim();
        const isManual = message.content.trim().toLowerCase() === manualTrigger.toLowerCase();

        if (isManual) {
            message.delete().catch(() => {});
            triggerAIGeneration(message.channel as TextChannel, aiOC);
            triggered = true;
            continue; 
        }

        if (aiOC.ai.autoMode) {
            if (autoTimers.has(aiOC.id)) {
                clearTimeout(autoTimers.get(aiOC.id)!);
            }

            const delayMs = (aiOC.ai.replyDelay || 30) * 1000;
            const timer = setTimeout(() => {
                triggerAIGeneration(message.channel as TextChannel, aiOC);
                autoTimers.delete(aiOC.id);
            }, delayMs);

            autoTimers.set(aiOC.id, timer);
        }
    }

    return triggered;
}

async function triggerAIGeneration(channel: TextChannel, oc: any) {
    await channel.sendTyping().catch(() => {});

    const rawMsgs = await channel.messages.fetch({ limit: 15 });
    
    const msgs = Array.from(rawMsgs.values())
        .reverse()
        .filter(m => !m.content.startsWith("rp!") && !m.content.includes(":ai") && m.content.trim() !== "");

    let chatHistory = msgs.map(m => {
        const authorName = m.author.username; 
        return `${authorName}: ${m.content}`;
    }).join("\n");

    const mems = oc.ai.memories.map((m: any) => `- ${m.content}`).join("\n");

    const masterPrompt = `Você está prestes a interpretar o personagem "${oc.name}" em um Roleplay de texto.
Esta é a sua Persona (Quem tu és, a tua história e forma de agir):
${oc.ai.persona}

Estas são suas Memórias e regras cruciais que aprendeste:
${mems || "Ainda não tens memórias adicionais."}

E esse é o Histórico recente de mensagens:
${chatHistory}

Responda de forma natural à última mensagem da conversa, agindo como se estivesse participando da conversa e agindo ESTRITAMENTE IGUAL ao teu personagem. Não dê avisos de IA.

⚠️ REGRA CRUCIAL DE FORMATAÇÃO ⚠️
Você deve retornar EXCLUSIVAMENTE um objeto JSON válido (sem blocos de código markdown ou crases) contendo duas chaves:
1. "resposta": A fala e ação do seu personagem para o chat (string).
2. "novas_memorias": Uma lista de strings curtas (max 100 caracteres cada) com fatos novos e muito importantes que você aprendeu nesta conversa e que seu personagem deve lembrar no futuro (ex: o nome de alguém novo, um segredo revelado, um local descoberto). Se não houver nada realmente novo ou relevante para lembrar, retorne uma lista vazia [].

Exemplo de formato esperado:
{
    "resposta": "*Te encaro de cima a baixo com um olhar desconfiado* Quem é você e como sabe o meu nome?",
    "novas_memorias": ["Conheci um estranho na taverna", "O estranho sabe o meu nome verdadeiro"]
}`;

    const aiConfig = getGuildAIConfig(channel.guild.id);
    
    if (!aiConfig) {
        await channel.send("❌ **Erro:** Nenhuma IA está configurada ou liberada para este servidor. Use `rp!token` para arrumar isso.");
        return;
    }

    let respostaDaIA = "";
    let novasMemorias: string[] = [];

    try {
        let rawResponse = await chamarIA(masterPrompt, aiConfig);
        rawResponse = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const parsed = JSON.parse(rawResponse); 
        respostaDaIA = parsed.resposta;
        novasMemorias = parsed.novas_memorias || [];
        
    } catch (e) {
        console.error("Erro ao fazer parse do JSON ou chamar a API:", e);
        respostaDaIA = "*[Erro de IA: O sistema falhou ao gerar um pensamento estruturado ou a chave/modelo é inválida.]*";
    }

    if (novasMemorias.length > 0) {
        for (const mem of novasMemorias) {
            if (!oc.ai.memories.some((m: any) => m.content === mem)) {
                oc.ai.memories.push({
                    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5), 
                    content: mem
                });
            }
        }
        oc.markModified('ai.memories');
        await oc.save();
        console.log(`🧠 [IA] ${novasMemorias.length} novas memórias salvas para ${oc.name}.`);
    }

    try {
        const hooks = await channel.fetchWebhooks();
        let hook = hooks.find(w => w.owner?.id === channel.client.user?.id);
        
        if (!hook) {
            hook = await channel.createWebhook({ name: "RPTool OC IA" }); 
        }

        await hook.send({
            content: respostaDaIA,
            username: oc.name,
            avatarURL: oc.avatar
        });
    } catch (err) {
        console.error("Erro ao enviar webhook da IA:", err);
    }
}