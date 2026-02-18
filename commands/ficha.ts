import { 
    Message, TextChannel, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ComponentType 
} from "discord.js";
import { Command } from "../interfaces/Command";
import { TemplateModel, FichaModel } from "../models/FichaSchema";
import { OCModel } from "../models/OCSchema"; 

function compilarTemplate(rawText: string) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);
    const fields = [];

    for (const line of lines) {
        if (!line.includes(':')) continue;
        
        const [namePart, ...ruleParts] = line.split(':');
        const name = namePart.trim();
        const rules = ruleParts.join(':').trim(); 
        
        const isOptional = rules.includes('|maynot|');
        const isPrefix = rules.includes('|prefix|');
        
        let type = "string";
        if (rules.includes('|int|')) type = "int";
        else if (rules.includes('|float|')) type = "float";
        else if (rules.includes('|image|')) type = "image";
        else if (rules.includes('|if|')) type = "if";

        let options: any[] = [];
        
        if (type === "if") {
            const ifContent = rules.split('|if|')[1].replace('|maynot|', '').trim();
            const rawOptions = ifContent.split(';').map(o => o.trim()).filter(o => o);
            
            for (const opt of rawOptions) {
                if (opt.includes(' for ')) {
                    const [optName, conditionRaw] = opt.split(' for ');
                    const condMatch = conditionRaw.trim().match(/([a-zA-ZÀ-ÿ0-9_]+)\s*(=|>|<|>=|<=)\s*(\d+)/);
                    const reverseMatch = conditionRaw.trim().match(/([a-zA-ZÀ-ÿ0-9_]+)\s*=\s*(\d+)(>|<)/);

                    if (reverseMatch) {
                        options.push({ val: optName.trim(), dep: reverseMatch[1], op: reverseMatch[3] === '>' ? '>=' : '<=', limit: Number(reverseMatch[2]) });
                    } else if (condMatch) {
                        options.push({ val: optName.trim(), dep: condMatch[1], op: condMatch[2], limit: Number(condMatch[3]) });
                    }
                } else {
                    opt.split(',').forEach(o => options.push({ val: o.trim() }));
                }
            }
        }
        fields.push({ name, type, required: !isOptional, isPrefix, options });
    }
    return fields;
}


export const command: Command = {
    name: "ficha",
    description: "Gerencia o sistema de Fichas e aprovações do RPG.",
    aliases: ["fichas", "sheet"],
    execute: async (message: Message | any, args: string[]) => {
        const action = args[0]?.toLowerCase();
        const guildId = message.guild.id;

        if (!message.member.permissions.has("Administrator") && ["create", "check", "hall", "purge", "oc", "reset"].includes(action)) {
            return message.reply("❌ Apenas administradores podem configurar o Motor de Fichas.");
        }

        switch (action) {
            case "create": {
                if (args[1]?.toLowerCase() !== "new") return message.reply("Uso: `rp!ficha create new`");
                
                message.reply("📝 **Criando a Ficha Universal para RP.**\nDigite a estrutura da ficha usando as tags (`|string|`, `|int|`, `|if|`, etc). Digite **END** quando terminar.");
                
                const filter = (m: Message) => m.author.id === message.author.id;
                const collected = await message.channel.awaitMessages({ filter, max: 1, time: 600000 });
                const rawContent = collected.first()?.content;

                if (!rawContent || rawContent.trim() === "END") return message.reply("❌ Operação cancelada.");

                const finalContent = rawContent.endsWith("END") ? rawContent.slice(0, -3).trim() : rawContent;
                
                try {
                    const compiledFields = compilarTemplate(finalContent);
                    
                    await TemplateModel.findOneAndUpdate(
                        { guildId }, 
                        { guildId, rawText: finalContent, fields: compiledFields },
                        { upsert: true }
                    );

                    return message.reply(`✅ **Ficha Universal criada com sucesso!**\nDetectei **${compiledFields.length}** campos obrigatórios/opcionais.`);
                } catch (e) {
                    return message.reply("❌ Erro ao compilar a ficha. Verifique a sintaxe.");
                }
            }

            case "check": {
                const targetChannel = message.mentions.channels.first() || message.channel;
                await TemplateModel.findOneAndUpdate({ guildId }, { checkChannelId: targetChannel.id }, { upsert: true });
                return message.reply(`✅ Canal de **Aprovação (Check)** definido para <#${targetChannel.id}>.`);
            }

            case "hall": {
                const targetChannel = message.mentions.channels.first() || message.channel;
                await TemplateModel.findOneAndUpdate({ guildId }, { hallChannelId: targetChannel.id }, { upsert: true });
                return message.reply(`🏛️ Canal do **Hall da Fama** definido para <#${targetChannel.id}>.`);
            }

            case "oc": {
                if (args[1]?.toLowerCase() !== "on") return message.reply("Uso: `rp!ficha oc on \"Prefixo: |prefix|\"`");
                

                const match = message.content.match(/["'](.*?)["']/);
                if (!match) return message.reply("❌ Você precisa colocar o formato do prefixo entre aspas! Ex: `rp!ficha oc on \"Prefixo: |prefix|\"`");
                
                const appendedText = match[1]; 
                const prefixLabel = appendedText.split(':')[0].trim(); 

                const t = await TemplateModel.findOne({ guildId });
                if (!t) return message.reply("❌ Crie um template primeiro com `rp!ficha create new` antes de ativar o OC!");

                let newRawText = t.rawText;
                
                if (!newRawText.includes(appendedText)) {
                    newRawText += `\n${appendedText}`;
                }

                try {
                    const compiledFields = compilarTemplate(newRawText);

                    await TemplateModel.findOneAndUpdate(
                        { guildId }, 
                        { 
                            rawText: newRawText,
                            fields: compiledFields,
                            ocIntegration: true, 
                            ocPrefixLabel: prefixLabel 
                        }, 
                        { upsert: true }
                    );
                    return message.reply(`🤖 **Integração com OC Ativada!**\nO campo **${appendedText}** foi adicionado automaticamente ao final da planta da sua ficha!`);
                } catch (e) {
                    return message.reply("❌ Erro ao recompilar a ficha com o novo prefixo.");
                }
            }

            case "edit": {
                const t = await TemplateModel.findOne({ guildId });
                if (!t) return message.reply("❌ Não existe template para editar. Use `create new`.");
                return message.reply(`✏️ **Template Atual:**\n\`\`\`text\n${t.rawText}\n\`\`\`\nUse \`rp!ficha create new\` para sobrescrever.`);
            }

            case "end": {
                const name = args.slice(1).join(" ").replace(/['"]/g, '');
                if (!name) return message.reply("Uso: `rp!ficha end \"Nome do Personagem\"`");

                const deleted = await FichaModel.findOneAndDelete({ guildId, characterName: new RegExp(`^${name}$`, 'i') });
                if (!deleted) return message.reply("❌ Personagem não encontrado.");

                if (deleted.hallMessageId) {
                    const t = await TemplateModel.findOne({ guildId });
                    if (t && t.hallChannelId) {
                        try {
                            const hallChan = await message.guild.channels.fetch(t.hallChannelId) as TextChannel;
                            const hallMsg = await hallChan.messages.fetch(deleted.hallMessageId);
                            if (hallMsg) await hallMsg.delete();
                        } catch (e) {} 
                    }
                }
                return message.reply(`🗑️ Ficha de **${deleted.characterName}** foi destruída.`);
            }

            case "purge": {
                await FichaModel.deleteMany({ guildId, status: "approved" });
                return message.reply("🔥 **PURGE CONCLUÍDO.** Todas as fichas aprovadas foram obliteradas.");
            }

            case "reset": {
                await TemplateModel.findOneAndDelete({ guildId });
                await FichaModel.deleteMany({ guildId });
                return message.reply("💥 **RESET TOTAL.** O template da ficha e todos os personagens (aprovados e pendentes) foram dizimados do banco de dados.");
            }

            default:
                message.reply("Comandos: `create new`, `check #chat`, `hall #chat`, `oc on \"Prefixo\"`, `end \"Nome\"`, `edit`, `purge`, `reset`.");
        }
    }
};

export async function handleFichaSubmit(message: Message) {
    if (message.author.bot || message.content.startsWith("rp!")) return false;

    if (!message.guild) return false;

    const guildId = message.guild.id;
    const template = await TemplateModel.findOne({ guildId });

    if (!template || !template.fields.length) return false;

    const firstField = template.fields[0].name;
    if (!message.content.toLowerCase().includes(`${firstField.toLowerCase()}:`)) return false;

    let parsedData: Record<string, any> = {};
    let content = message.content;
    
    if (message.attachments.size > 0) {
        parsedData['__avatar__'] = message.attachments.first()?.url;
    }

    for (let i = 0; i < template.fields.length; i++) {
        const currentField = template.fields[i];

        const regexStart = new RegExp(`${currentField.name}:`, 'i');
        const matchStart = content.match(regexStart);
        
        if (!matchStart) {
            if (currentField.required) return false; 
            continue;
        }

        const startIndex = matchStart.index! + matchStart[0].length;
        let endIndex = content.length; 

        for (let j = i + 1; j < template.fields.length; j++) {
            const nextFieldToFind = template.fields[j];
            const regexNext = new RegExp(`${nextFieldToFind.name}:`, 'i');
            const matchNext = content.substring(startIndex).match(regexNext);
            
            if (matchNext) {
                endIndex = startIndex + matchNext.index!;
                break; 
            }
        }

        const extractedValue = content.substring(startIndex, endIndex).trim();

        if (currentField.type === "int") {
            const num = parseInt(extractedValue);
            if (isNaN(num)) { message.reply(`❌ O campo **${currentField.name}** precisa ser um número inteiro!`); return true; }
            parsedData[currentField.name] = num;
        } 
        else if (currentField.type === "float") {
            const num = parseFloat(extractedValue.replace(',', '.'));
            if (isNaN(num)) { message.reply(`❌ O campo **${currentField.name}** precisa ser numérico!`); return true; }
            parsedData[currentField.name] = num;
        }
        else {
            parsedData[currentField.name] = extractedValue;
        }
    }

    for (const field of template.fields) {
        if (field.type === "if" && parsedData[field.name]) {
            const userChoice = parsedData[field.name].toLowerCase();
            const validOptions = field.options;
            
            let isAllowed = false;
            let ruleBroken = "";

            for (const opt of validOptions) {
                if (opt.val.toLowerCase() === userChoice) {
                    if (opt.dep) {
                        const depValue = parsedData[opt.dep];
                        if (opt.op === '>=' && depValue >= opt.limit) isAllowed = true;
                        else if (opt.op === '<=' && depValue <= opt.limit) isAllowed = true;
                        else ruleBroken = `Requisito não atingido: ${opt.dep} precisa ser ${opt.op} ${opt.limit} para ser ${opt.val}.`;
                    } else {
                        isAllowed = true;
                    }
                    break;
                }
            }

            if (!isAllowed) {
                message.reply(`❌ Escolha inválida para **${field.name}**. ${ruleBroken || 'Opção não existe.'}`);
                return true;
            }
        }
    }

    message.reply("📨 Sua ficha foi formatada e enviada para a avaliação dos Administradores!");
    
    const characterName = parsedData["Nome"] || parsedData["Name"] || "Desconhecido";
    const avatar = parsedData['__avatar__'] || message.author.displayAvatarURL();

    const fichaDoc = await FichaModel.create({
        guildId, userId: message.author.id, characterName, data: parsedData, avatar
    });

    if (template.checkChannelId) {
        const checkChan = await message.guild!.channels.fetch(template.checkChannelId) as TextChannel;
        if (checkChan) {
            const embed = new EmbedBuilder()
                .setTitle(`📋 Avaliação de Ficha: ${characterName}`)
                .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
                .setColor(0xFFA500)
                .setThumbnail(avatar);

            let desc = "";
            for (const [key, val] of Object.entries(parsedData)) {
                if (key !== '__avatar__') desc += `**${key}:** ${val}\n`;
            }
            embed.setDescription(desc.length > 4000 ? desc.substring(0, 4000) + "..." : desc);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`ficha_approve_${fichaDoc._id}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ficha_reject_${fichaDoc._id}`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
            );

            await checkChan.send({ embeds: [embed], components: [row] });
        }
    }
    return true; 
}

export async function handleFichaInteraction(interaction: any) {
    if (!interaction.isButton() || !interaction.customId.startsWith('ficha_')) return;
    
    if (!interaction.member.permissions.has("Administrator")) {
        return interaction.reply({ content: "🚫 Só Administradores avaliam fichas.", ephemeral: true });
    }

    const [_, action, fichaId] = interaction.customId.split('_');
    const ficha = await FichaModel.findById(fichaId);
    if (!ficha) return interaction.reply({ content: "Ficha não encontrada no banco.", ephemeral: true });

    if (action === "reject") {
        await FichaModel.findByIdAndDelete(fichaId);
        await interaction.update({ content: `❌ Ficha de **${ficha.characterName}** foi RECUSADA por ${interaction.user.username}.`, embeds: [], components: [] });
        return;
    }

    if (action === "approve") {
        ficha.status = "approved";
        const template = await TemplateModel.findOne({ guildId: interaction.guildId });

        if (template?.hallChannelId) {
            const hallChan = await interaction.guild.channels.fetch(template.hallChannelId) as TextChannel;
            if (hallChan) {
                const embed = new EmbedBuilder()
                    .setTitle(`✨ Novo Personagem Aprovado: ${ficha.characterName}`)
                    .setColor(0x00FF00)
                    .setImage(ficha.avatar);
                
                let desc = "";
                for (const [key, val] of Object.entries(ficha.data)) {
                    if (key !== '__avatar__') desc += `**${key}:** ${val}\n`;
                }
                embed.setDescription(desc.length > 4000 ? desc.substring(0, 4000) + "..." : desc);

                const hallMsg = await hallChan.send({ content: `<@${ficha.userId}>`, embeds: [embed] });
                ficha.hallMessageId = hallMsg.id;
            }
        }

        await ficha.save();

        if (template?.ocIntegration) {
            const nameKeys = ["nome", "name"];
            const bioKeys = ["história", "historia", "lore", "history"];
            
            let ocName = ficha.characterName;
            let ocBio = "";
            let ocPrefix = "";
            const ocExtras = new Map<string, string>();

            for (const [key, val] of Object.entries(ficha.data)) {
                const kLower = key.toLowerCase();
                if (key === '__avatar__') continue;
                
                if (template.ocPrefixLabel && kLower === template.ocPrefixLabel.toLowerCase()) {
                    ocPrefix = val;
                }
                else if (nameKeys.includes(kLower)) {
                    ocName = val;
                }
                else if (bioKeys.includes(kLower)) {
                    ocBio = val;
                }
                else {
                    ocExtras.set(key, String(val));
                }
            }

            try {
                await OCModel.create({
                    adminId: ficha.userId,
                    name: ocName,
                    prefix: ocPrefix || ocName.toLowerCase(), 
                    suffix: "",
                    avatar: ficha.avatar,
                    wiki: { bio: ocBio, extras: ocExtras, sections: [], references: [] }
                });
            } catch (err) {
                console.error("Erro ao integrar com OCModel.", err);
            }
        }
        await interaction.update({ content: `✅ Ficha de **${ficha.characterName}** APROVADA por ${interaction.user.username}!`, components: [] });
    }
}