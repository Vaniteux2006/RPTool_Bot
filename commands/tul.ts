import { 
    Message, 
    MessageCollector, 
    TextChannel, 
    AttachmentBuilder,
    Webhook,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ComponentType
} from "discord.js";
import { Command } from "../interfaces/Command";
import { TupperModel } from "../models/TupperSchema"; 
import axios from 'axios';

// =====================================================================
// HELPER: Extrai nome inteligente (com ou sem aspas/crases)
// =====================================================================
const extractName = (content: string, commandName: string) => {
    // Localiza o subcomando na mensagem (ex: "create")
    const cmdIndex = content.toLowerCase().indexOf(commandName.toLowerCase());
    if (cmdIndex === -1) return null;

    const rawArgs = content.slice(cmdIndex + commandName.length).trim();

    // Regex: Nome (Aspas "", '', `` ou palavra) + Resto Opcional
    const match = rawArgs.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))(\s+(.+))?$/);
    
    if (!match) return null;

    return {
        name: match[2] || match[3] || match[4] || match[5], 
        rest: match[7]?.trim() || "" 
    };
};

// Helper de limpeza de wrapper (`text` -> text)
const cleanWrapper = (str: string) => {
    if ((str.startsWith('`') && str.endsWith('`')) || 
        (str.startsWith('"') && str.endsWith('"')) || 
        (str.startsWith("'") && str.endsWith("'"))) {
        return str.slice(1, -1);
    }
    return str;
};

// =====================================================================
// COMANDO PRINCIPAL
// =====================================================================
export const command: Command = {
    name: "tul",
    description: "Gerencia seus Tuppers (Personagens)",
    aliases: ["tupper", "char", "t"],
    execute: async (message: Message | any, args: string[]) => {
        
        if (!args[0]) {
            return message.reply(`
**Comandos do RPTool Tupper:**
\`create, list, delete, avatar, prefix, name, edit\`
\`ai, persona, memories, gaslight, forget, insert, end\`
\`group, duo, solo, import, export, purge, birthday\`
Use \`rp!help tul\` para detalhes.
            `);
        }

        const action = args[0].toLowerCase();
        const userId = message.author.id;

        try {
            switch (action) {

                case "create": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted || !extracted.rest) return message.reply("⚠️ Uso: `rp!tul create \"Nome\" prefixo:text`");

                    const { name, rest } = extracted;
                    
                    const attachment = message.attachments.first();
                    let patternRaw = rest;

                    // Remove URL se estiver no texto
                    const urlInText = args.find(a => a.startsWith("http"));
                    if (urlInText) patternRaw = patternRaw.replace(urlInText, "").trim();

                    const avatarUrl = attachment ? attachment.url : urlInText;
                    if (!avatarUrl) return message.reply("❌ Erro: Precisa de imagem (anexo ou link).");

                    if (!patternRaw.includes("text")) return message.reply("⚠️ O padrão precisa ter **`text`**. Ex: `nome:text`");

                    const parts = patternRaw.split("text");
                    const prefix = cleanWrapper(parts[0].trim());
                    const suffix = cleanWrapper(parts.slice(1).join("text").trim());

                    const exists = await TupperModel.findOne({ adminId: userId, name: name });
                    if (exists) return message.reply("❌ Já existe um tupper com esse nome!");

                    await TupperModel.create({
                        adminId: userId, name, prefix, suffix, avatar: avatarUrl, createdAt: new Date()
                    });

                    let msg = `✅ Tupper **${name}** criado!\nExemplo: \`${prefix}Oi${suffix}\``;
                    return message.reply(msg);
                }

                case "delete": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual tupper? `rp!tul delete \"Nome\"`");

                    const deleted = await TupperModel.findOneAndDelete({ adminId: userId, name: extracted.name });
                    if (!deleted) return message.reply("Tupper não encontrado.");
                    return message.reply(`🗑️ Tupper **${extracted.name}** deletado.`);
                }

                case "avatar": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual tupper? `rp!tul avatar \"Nome\"`");

                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply("Tupper não encontrado.");

                    const attachment = message.attachments.first();
                    // Se tiver resto no extracted, pode ser o link
                    const newAvatar = attachment ? attachment.url : (extracted.rest.startsWith("http") ? extracted.rest : null);

                    if (!newAvatar) return message.reply(`🖼️ Avatar atual de **${tupper.name}**: ${tupper.avatar}`);

                    tupper.avatar = newAvatar;
                    await tupper.save();
                    return message.reply("✅ Avatar atualizado!");
                }

                case "name":
                case "rename": {
                    // Rename é chato pq tem 2 nomes. Vamos usar o regex manual aqui.
                    // rp!tul rename "Velho" "Novo"
                    const rawArgs = message.content.slice(message.content.toLowerCase().indexOf(action) + action.length).trim();
                    const match = rawArgs.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))$/);

                    if (!match) return message.reply("Uso: `rp!tul rename \"Antigo\" \"Novo\"`");

                    const oldName = match[2] || match[3] || match[4] || match[5];
                    // O segundo nome começa no grupo 6, então os subgrupos são 7,8,9,10
                    const newName = match[7] || match[8] || match[9] || match[10];

                    const tupper = await TupperModel.findOne({ adminId: userId, name: oldName });
                    if (!tupper) return message.reply("Tupper não encontrado.");

                    tupper.name = newName;
                    await tupper.save();
                    return message.reply(`✅ Renomeado para **${newName}**.`);
                }

                case "prefix":
                case "prefixo": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted || !extracted.rest) return message.reply("Uso: `rp!tul prefix \"Nome\" novo:text`");

                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply(`❌ Tupper **${extracted.name}** não encontrado.`);

                    if (!extracted.rest.includes("text")) return message.reply("⚠️ Precisa ter **`text`**. Ex: `k!text`");

                    const parts = extracted.rest.split("text");
                    tupper.prefix = cleanWrapper(parts[0].trim());
                    tupper.suffix = cleanWrapper(parts.slice(1).join("text").trim());

                    await tupper.save();
                    return message.reply(`✅ Novo padrão: \`${tupper.prefix}Oi${tupper.suffix}\``);
                }

                case "list": {
                    // 1. Identifica o alvo (Usuário mencionado, ID ou o próprio autor)
                    let targetId = userId;
                    // Se o primeiro argumento for menção ou ID, atualiza o targetId
                    if (message.mentions.users.first()) {
                        targetId = message.mentions.users.first()!.id;
                    } else if (args[1] && args[1].length > 15) {
                        targetId = args[1];
                    }

                    // 2. Busca e Filtros
                    const query = { $or: [ { adminId: targetId }, { duoIds: targetId } ] };
                    const totalDocs = await TupperModel.countDocuments(query);
                    if (totalDocs === 0) return message.reply("📭 Nenhum tupper encontrado.");

                    // 3. Função para Gerar o Embed de uma Página
                    const generateEmbed = async (page: number) => {
                        const pageSize = 5; // Reduzi pra 5 pra caber mais info sem poluir
                        const skip = (page - 1) * pageSize;
                        
                        // Busca os tuppers dessa página
                        const tuppers = await TupperModel.find(query).skip(skip).limit(pageSize);
                        
                        const totalPages = Math.ceil(totalDocs / pageSize);

                        // Monta a string da lista
                        const listStr = tuppers.map(t => {
                            const isOwner = t.adminId === targetId;
                            const icon = isOwner ? "👑" : "🤝";
                            const aiStatus = t.ai.enabled ? "🤖 [IA ON]" : "";
                            
                            // Datas bonitinhas
                            const created = t.createdAt ? t.createdAt.toLocaleDateString('pt-BR') : "Desconhecido";
                            const bday = t.realBirthday ? ` | 🎉 ${t.realBirthday.getDate()}/${t.realBirthday.getMonth() + 1}` : "";

                            return `**${icon} ${t.name}** ${aiStatus}
> 🗣️ **Padrão:** \`${t.prefix}text${t.suffix}\`
> 💬 **Msgs:** ${t.messageCount}
> 📂 **Grupo:** ${t.group || "Nenhum"}
> 📅 **Criado:** ${created}${bday}
> 🖼️ [Ver Avatar](${t.avatar})`;
                        }).join("\n\n");

                        return {
                            embeds: [{
                                title: `📒 Lista de Tuppers (${page}/${totalPages})`,
                                description: listStr,
                                color: 0xFFFF00, // Amarelo Bob Esponja 🧽
                                footer: { text: `Total de Tuppers: ${totalDocs}` },
                                thumbnail: { url: tuppers[0]?.avatar } // Mostra avatar do primeiro como destaque (opcional)
                            }],
                            totalPages
                        };
                    };

                    // 4. Envia a Primeira Página
                    let currentPage = 1;
                    const { embeds, totalPages } = await generateEmbed(currentPage);
                    
                    // Se só tiver 1 página, não precisa de botões
                    if (totalPages === 1) {
                        return message.channel.send({ embeds });
                    }

                    // Cria Botões
                    const row = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('prev_page')
                                .setLabel('⬅️ Anterior')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true), // Começa desativado
                            new ButtonBuilder()
                                .setCustomId('next_page')
                                .setLabel('Próximo ➡️')
                                .setStyle(ButtonStyle.Primary)
                        );

                    const msg = await message.channel.send({ embeds, components: [row] });

                    // 5. Coletor de Interações (Botões)
                    const collector = msg.createMessageComponentCollector({ 
                        componentType: ComponentType.Button, 
                        time: 60000 // Botões funcionam por 1 minuto
                    });

                    collector.on('collect', async (i) => {
                        if (i.user.id !== userId) {
                            return i.reply({ content: "🚫 Só quem pediu a lista pode mexer.", ephemeral: true });
                        }

                        if (i.customId === 'prev_page' && currentPage > 1) currentPage--;
                        if (i.customId === 'next_page' && currentPage < totalPages) currentPage++;

                        const newData = await generateEmbed(currentPage);

                        // Atualiza estado dos botões
                        row.components[0].setDisabled(currentPage === 1);
                        row.components[1].setDisabled(currentPage === totalPages);

                        await i.update({ embeds: newData.embeds, components: [row] });
                    });

                    collector.on('end', () => {
                        // Desativa botões quando o tempo acaba
                        row.components.forEach(b => b.setDisabled(true));
                        msg.edit({ components: [row] }).catch(() => {});
                    });
                    
                    break;
                }

                case "ai": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual tupper? `rp!tul ai \"Nome\"`");
                    
                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply("Tupper não encontrado.");

                    message.reply(`📝 **Configurando IA para ${tupper.name}**\nEnvie a PERSONALIDADE. Digite **END** pra acabar.`);
                    const collector = new MessageCollector(message.channel as TextChannel, { filter: m => m.author.id === userId, time: 300000 });
                    let personaText = "";
                    collector.on('collect', m => {
                        if (m.content.trim() === "END") collector.stop("finished");
                        else personaText += m.content + "\n";
                    });
                    collector.on('end', async (_, reason) => {
                        if (reason === "finished") {
                            tupper.ai.enabled = true;
                            tupper.ai.persona = personaText;
                            await tupper.save();
                            message.channel.send(`🤖 IA Ativada para **${tupper.name}**!`);
                        }
                    });
                    break;
                }

                case "insert": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual tupper? `rp!tul insert \"Nome\"`");

                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply("Tupper não encontrado.");
                    if (!tupper.ai.enabled) return message.reply("IA não configurada. Use `rp!tul ai` antes.");

                    tupper.ai.activeChannelId = message.channel.id;
                    await tupper.save();
                    return message.reply(`🤖 **${tupper.name}** inserido no canal.`);
                }
                
                // End não precisa de nome, é global pro canal
                case "end": {
                    const tupper = await TupperModel.findOne({ adminId: userId, "ai.activeChannelId": message.channel.id });
                    if (!tupper) return message.reply("Nenhum tupper seu ativo aqui.");
                    tupper.ai.activeChannelId = null;
                    await tupper.save();
                    return message.reply(`💤 **${tupper.name}** saiu.`);
                }

                case "memories": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual tupper?");
                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply("Tupper não encontrado.");
                    
                    const list = tupper.ai.memories.map(m => `🆔 \`${m.id}\`: ${m.content.substring(0, 50)}...`).join("\n");
                    return message.channel.send(`🧠 **Memórias de ${tupper.name}:**\n${list || "Vazio."}`);
                }

                case "gaslight": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual tupper?");
                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply("Tupper não encontrado.");

                    message.reply("🧠 **Escreva a memória falsa (END para sair):**");
                    const collector = new MessageCollector(message.channel as TextChannel, { filter: m => m.author.id === userId, time: 60000 });
                    let mem = "";
                    collector.on('collect', m => { if (m.content === "END") collector.stop("done"); else mem += m.content + " "; });
                    collector.on('end', async (_, r) => {
                        if (r === "done") {
                            tupper.ai.memories.push({ id: Date.now().toString(36), content: mem });
                            await tupper.save();
                            message.channel.send("🧠 Memória implantada.");
                        }
                    });
                    break;
                }

                case "forget": {
                    // rp!tul forget "Nome" ID
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted || !extracted.rest) return message.reply("Uso: `rp!tul forget \"Nome\" ID_MEMORIA`");
                    
                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply("Tupper não encontrado.");

                    const initial = tupper.ai.memories.length;
                    tupper.ai.memories = tupper.ai.memories.filter(m => m.id !== extracted.rest);
                    if (tupper.ai.memories.length === initial) return message.reply("Memória não achada.");

                    await tupper.save();
                    return message.reply("🧠 Esquecido.");
                }

                case "alzheimer": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual tupper?");
                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply("Tupper não encontrado.");
                    
                    tupper.ai.memories = [];
                    await tupper.save();
                    return message.reply(`🤯 **${tupper.name}** esqueceu tudo.`);
                }

                case "puppet": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual tupper?");
                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply("Tupper não encontrado.");

                    tupper.ai.enabled = false;
                    tupper.ai.activeChannelId = null;
                    await tupper.save();
                    return message.reply(`🧵 **${tupper.name}** virou fantoche.`);
                }

                // === DUO / SOLO / GROUP / BIRTHDAY ===

                case "duo": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual tupper?");
                    const targetUser = message.mentions.users.first();
                    if (!targetUser) return message.reply("Marque alguém!");

                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply("Não achado ou sem permissão.");
                    if (tupper.ai.enabled) return message.reply("🚫 IA não pode ser Duo.");

                    if (!tupper.duoIds.includes(targetUser.id)) {
                        tupper.duoIds.push(targetUser.id);
                        await tupper.save();
                    }
                    return message.reply(`🤝 **${tupper.name}** compartilhado com ${targetUser.username}!`);
                }

                case "solo": {
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted) return message.reply("Qual tupper?");
                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply("Não achado ou sem permissão.");

                    tupper.duoIds = [];
                    await tupper.save();
                    return message.reply(`🔒 **${tupper.name}** é só seu agora.`);
                }

                case "birthday": {
                    // rp!tul birthday "Nome" 12/05
                    const extracted = extractName(message.content, args[0]);
                    if (!extracted || !extracted.rest) return message.reply("Uso: `rp!tul birthday \"Nome\" DD/MM`");
                    
                    const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                    if (!tupper) return message.reply("Tupper não encontrado.");

                    const [d, m, y] = extracted.rest.split("/").map(Number);
                    if (!d || !m) return message.reply("Data inválida.");
                    tupper.realBirthday = new Date(y || 2000, m - 1, d);
                    await tupper.save();
                    return message.reply(`🎂 Aniversário de **${tupper.name}** salvo!`);
                }

                case "group": {
                    // Subcomandos: list, create, add, remove (membro), delete (grupo inteiro)
                    const sub = args[1]?.toLowerCase();
                    
                    if (!sub) return message.reply("Uso: `list`, `create`, `add`, `remove`, `delete`.");

                    // === LISTAR GRUPOS ===
                    if (sub === "list") {
                        const groups = await TupperModel.distinct("group", { adminId: userId });
                        const validGroups = groups.filter(g => g); // Remove nulos
                        if (validGroups.length === 0) return message.reply("Você não tem nenhum grupo.");
                        return message.reply(`📂 **Seus Grupos:**\n${validGroups.join("\n")}`);
                    }

                    // === CRIAR GRUPO ===
                    if (sub === "create") {
                        const rawArgs = message.content.slice(message.content.toLowerCase().indexOf("create") + 6).trim();
                        const match = rawArgs.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))$/);

                        if (!match) return message.reply("Uso: `rp!tul group create \"Novo Grupo\" \"Nome do Tupper\"`");

                        const gName = match[2] || match[3] || match[4] || match[5];
                        const tName = match[7] || match[8] || match[9] || match[10];

                        const tupper = await TupperModel.findOne({ adminId: userId, name: tName });
                        if (!tupper) return message.reply(`❌ Tupper **${tName}** não encontrado.`);

                        tupper.group = gName;
                        await tupper.save();

                        return message.reply(`✨ Grupo **${gName}** criado e **${tupper.name}** adicionado a ele!`);
                    }
                    
                    // === ADICIONAR AO GRUPO ===
                    if (sub === "add") {
                        const rawArgs = message.content.slice(message.content.toLowerCase().indexOf("add") + 3).trim();
                        const match = rawArgs.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))$/);
                        
                        if (!match) return message.reply("Uso: `rp!tul group add \"NomeGrupo\" \"NomeTupper\"`");
                        
                        const gName = match[2] || match[3] || match[4] || match[5];
                        const tName = match[7] || match[8] || match[9] || match[10];

                        const groupExists = await TupperModel.findOne({ adminId: userId, group: gName });
                        if (!groupExists) return message.reply(`⚠️ O grupo **${gName}** não existe.`);

                        const tupper = await TupperModel.findOne({ adminId: userId, name: tName });
                        if (!tupper) return message.reply(`❌ Tupper **${tName}** não encontrado.`);
                        
                        tupper.group = gName;
                        await tupper.save();
                        return message.reply(`📂 **${tupper.name}** adicionado ao grupo **${gName}**.`);
                    }

                    // === REMOVER MEMBRO DO GRUPO ===
                    if (sub === "remove") {
                        const extracted = extractName(message.content, sub);
                        if (!extracted) return message.reply(`Uso: \`rp!tul group remove "NomeTupper"\``);

                        const tupper = await TupperModel.findOne({ adminId: userId, name: extracted.name });
                        if (!tupper) return message.reply("Tupper não encontrado.");

                        const oldGroup = tupper.group;
                        if (!oldGroup) return message.reply("Esse tupper nem está em grupo.");

                        tupper.group = null;
                        await tupper.save();

                        return message.reply(`🌧️ **${tupper.name}** saiu do grupo **${oldGroup}**.`);
                    }

                    // === DELETAR GRUPO INTEIRO ===
                    if (sub === "delete") {
                        // rp!tul group delete "NomeGrupo"
                        const extracted = extractName(message.content, sub);
                        if (!extracted) return message.reply(`Uso: \`rp!tul group delete "NomeDoGrupo"\``);
                        
                        const groupName = extracted.name;

                        // Verifica se o grupo existe (tem pelo menos um membro)
                        const members = await TupperModel.find({ adminId: userId, group: groupName });
                        
                        if (members.length === 0) return message.reply(`❌ Grupo **${groupName}** não encontrado.`);

                        // Remove a etiqueta de grupo de todos os membros
                        await TupperModel.updateMany(
                            { adminId: userId, group: groupName },
                            { $set: { group: null } }
                        );

                        return message.reply(`🗑️ Grupo **${groupName}** dissolvido. Os ${members.length} membros agora estão sem grupo.`);
                    }

                    return message.reply("Comando inválido.");
                }

                case "find":
                case "info": {
                    // rp!tul find "Nome"
                    // Usa nosso helper extractName, mas aqui o argumento é o BUSCA
                    const extracted = extractName(message.content, args[0]);
                    const searchTerm = extracted ? extracted.name : args.slice(1).join(" ");

                    if (!searchTerm) return message.reply("Quem você quer achar? `rp!tul find \"Nome\"`");

                    // Busca FLEXÍVEL (Case insensitive, parte do nome)
                    // Procura em TODOS os usuários (removemos o filtro adminId)
                    const tuppers = await TupperModel.find({ 
                        name: { $regex: searchTerm, $options: "i" } 
                    }).limit(5); // Limita a 5 pra não floodar se for termo genérico

                    if (tuppers.length === 0) return message.reply(`❌ Nenhum tupper encontrado com **"${searchTerm}"**.`);

                    if (tuppers.length > 1) {
                        // Se achou vários, lista resumida
                        const list = tuppers.map(t => `• **${t.name}** (Dono: <@${t.adminId}>)`).join("\n");
                        return message.reply(`🔍 Encontrei vários:\n${list}\n*Seja mais específico!*`);
                    }

                    // Se achou UM SÓ, mostra ficha completa
                    const t = tuppers[0];
                    
                    // Tenta pegar o user do Discord pra mostrar nome/tag
                    let ownerName = `<@${t.adminId}>`;
                    try {
                        const user = await message.client.users.fetch(t.adminId);
                        ownerName = `${user.username} (\`${user.id}\`)`;
                    } catch (e) {}

                    const created = t.createdAt ? t.createdAt.toLocaleDateString('pt-BR') : "Desconhecido";
                    const bday = t.realBirthday ? `${t.realBirthday.getDate()}/${t.realBirthday.getMonth() + 1}` : "Não definido";
                    const aiStatus = t.ai.enabled ? "✅ Ativa" : "❌ Desligada";

                    return message.channel.send({
                        embeds: [{
                            title: `🔎 Ficha de: ${t.name}`,
                            color: 0x00FF00, // Verde Matrix
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
                            image: { url: t.avatar } // Avatar grande no final também
                        }]
                    });
                }

                // Import/Export/Purge/Edit mantivemos simples pois não usam nome complexo (exceto Edit que não recebe args de nome)
                case "import": {
                    const attachment = message.attachments.first();
                    if (!attachment?.name?.endsWith(".json")) return message.reply("Anexe o arquivo `.json` do Tupperbox.");

                    try {
                        const res = await axios.get(attachment.url);
                        const data = res.data;
                        
                        if (!data.tuppers || !Array.isArray(data.tuppers)) {
                            return message.reply("❌ O arquivo não parece ser um backup válido do Tupperbox.");
                        }

                        let count = 0;
                        for (const t of data.tuppers) {
                            // 1. Data de Criação (Prioriza created_at, se não tiver usa agora)
                            const createdAt = t.created_at ? new Date(t.created_at) : new Date();

                            // 2. Aniversário (Birthday)
                            // Tupperbox manda "YYYY-MM-DD" ou null. Precisamos converter pra Date.
                            let realBirthday: Date | null = null;
                            if (t.birthday) {
                                // Tenta parsear a data. Pode vir "2000-05-12T..." ou só data
                                const bDate = new Date(t.birthday);
                                if (!isNaN(bDate.getTime())) {
                                    realBirthday = bDate;
                                }
                            }

                            // 3. Posts (Contador de mensagens)
                            const messageCount = typeof t.posts === 'number' ? t.posts : 0;

                            await TupperModel.updateOne(
                                { adminId: userId, name: t.name },
                                {
                                    adminId: userId,
                                    name: t.name,
                                    // Pega os brackets (se não tiver, deixa vazio)
                                    prefix: Array.isArray(t.brackets) ? t.brackets[0] || "" : "",
                                    suffix: Array.isArray(t.brackets) ? t.brackets[1] || "" : "",
                                    avatar: t.avatar_url || "", // Garante string vazia se nulo
                                    
                                    // Sincronização Completa
                                    messageCount: messageCount,
                                    createdAt: createdAt,
                                    realBirthday: realBirthday,
                                    
                                    // Preserva dados existentes se não vierem no import
                                    // (Ex: se vc já configurou IA ou Grupo no RPTool, não perde)
                                },
                                { upsert: true } // Cria se não existir, atualiza se existir
                            );
                            count++;
                        }
                        return message.reply(`📦 **${count}** tuppers importados com sucesso!\n✅ Datas, mensagens e aniversários sincronizados.`);
                    } catch (err) {
                        console.error(err);
                        return message.reply("❌ Erro ao processar o arquivo JSON.");
                    }
                }

                case "export": {
                    const tuppers = await TupperModel.find({ adminId: userId });
                    const json = JSON.stringify({ tuppers }, null, 2);
                    const buffer = Buffer.from(json, 'utf-8');
                    const att = new AttachmentBuilder(buffer, { name: 'tuppers.json' });
                    return message.reply({ content: "📦 Backup:", files: [att] });
                }

                case "purge": {
                    // Aviso de Perigo
                    const dangerEmbed = {
                        title: "⚠️ PERIGO: ZONA DE DESTRUIÇÃO",
                        description: "Você está prestes a **APAGAR TODOS** os seus tuppers.\nEssa ação é irreversível.\n\nTem certeza absoluta?",
                        color: 0xFF0000, // Vermelho Sangue
                        footer: { text: "Você tem 15 segundos para decidir." }
                    };

                    const row = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('purge_confirm')
                                .setLabel('🔥 SIM, APAGAR TUDO')
                                .setStyle(ButtonStyle.Danger), // Botão Vermelho
                            new ButtonBuilder()
                                .setCustomId('purge_cancel')
                                .setLabel('❌ Cancelar')
                                .setStyle(ButtonStyle.Secondary) // Botão Cinza
                        );

                    const msg = await message.reply({ embeds: [dangerEmbed], components: [row] });

                    // Coletor (Só o dono da mensagem pode clicar)
                    const collector = msg.createMessageComponentCollector({ 
                        componentType: ComponentType.Button, 
                        time: 15000 // 15 segundos pra pensar
                    });

                    collector.on('collect', async (i) => {
                        if (i.user.id !== userId) {
                            return i.reply({ content: "🚫 Saia daí! Esse botão não é pra você.", ephemeral: true });
                        }

                        if (i.customId === 'purge_confirm') {
                            await TupperModel.deleteMany({ adminId: userId });
                            await i.update({ 
                                content: "🔥 **KABOOM!** Todos os seus tuppers foram transformados em poeira cósmica.", 
                                embeds: [], 
                                components: [] 
                            });
                            collector.stop("deleted");
                        } else {
                            await i.update({ 
                                content: "✅ Operação cancelada. Seus tuppers estão salvos.", 
                                embeds: [], 
                                components: [] 
                            });
                            collector.stop("cancelled");
                        }
                    });

                    collector.on('end', (_, reason) => {
                        if (reason !== "deleted" && reason !== "cancelled") {
                            // Se o tempo acabou, desativa os botões
                            const disabledRow = new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(
                                    row.components[0].setDisabled(true),
                                    row.components[1].setDisabled(true)
                                );
                            msg.edit({ content: "⏰ Tempo esgotado.", components: [disabledRow] }).catch(() => {});
                        }
                    });
                    
                    break;
                }

                case "edit": {
                    const newText = args.slice(1).join(" ");
                    if (!newText) return message.reply("Digite o novo texto.");
                    
                    const myTuppers = await TupperModel.find({ adminId: userId });
                    const myNames = myTuppers.map(t => t.name);
                    const msgs = await message.channel.messages.fetch({ limit: 10 });
                    const target = msgs.find(m => m.webhookId && myNames.includes(m.author.username));
                    
                    if (!target) return message.reply("Nenhuma msg recente sua.");
                    const hooks = await (message.channel as TextChannel).fetchWebhooks();
                    const hook = hooks.find(w => w.id === target.webhookId);
                    
                    if (hook) {
                        await hook.editMessage(target.id, { content: newText });
                        message.delete().catch(() => {});
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

// =========================================================
// FUNÇÃO DE IA DO CHECKOUT
// =========================================================
export async function handleAIMessage(message: Message): Promise<boolean> {
    if (message.content.startsWith("rp!")) return false;
    const aiTupper = await TupperModel.findOne({ "ai.enabled": true, "ai.activeChannelId": message.channel.id });
    if (!aiTupper) return false;

    const channel = message.channel as TextChannel; 
    await channel.sendTyping().catch(() => {}); 

    try {
        const memories = aiTupper.ai.memories.map(m => m.content).join("\n");
        // Aqui vai a chamada real da API depois
        const responseText = `[IA ${aiTupper.name}]: Ouvi "${message.content}"`;
        await channel.send(`**${aiTupper.name}:** ${responseText}`);
        return true; 
    } catch (error) {
        console.error("Erro na IA:", error);
        return false;
    }
}