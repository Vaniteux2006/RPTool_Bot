// RPTool/supercommands/ficha/handlers/start.ts
import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from "discord.js";
import { TemplateModel, FichaModel } from "../../../tools/models/FichaSchema";

export default async function handleStart(message: Message, args: string[]) {
    const template = await TemplateModel.findOne({ guildId: message.guildId });
    if (!template || !template.fields || template.fields.length === 0) {
        return message.reply("❌ Este servidor não possui uma ficha configurada.");
    }

    let dmChannel;
    try {
        dmChannel = await message.author.createDM();
        await dmChannel.send(`📝 **Iniciando sua ficha para o servidor ${message.guild?.name}!**\nResponda às perguntas abaixo enviando uma nova mensagem. Digite **CANCELAR** a qualquer momento para parar.`);
        message.reply("📬 Te enviei uma mensagem na DM para preenchermos a ficha!");
    } catch (err) {
        return message.reply("❌ Não consigo te enviar mensagens na DM. Verifique se suas DMs estão abertas para este servidor.");
    }

    const respostas: Record<string, any> = {};
    let avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
    let characterName = "Personagem Desconhecido";

    for (const field of template.fields) {
        let question = `**${field.name}**`;
        if (field.isOptional) question += ` *(Opcional - Digite "pular" para ignorar)*`;
        if (field.type === 'if') question += `\n*Opções válidas: ${field.options.join(", ")}*`;
        if (field.type === 'image') question += `\n*Envie um link válido de imagem ou uma imagem em anexo.*`;

        await dmChannel.send(question);

        try {
            const collected = await dmChannel.awaitMessages({ 
                filter: (m: Message) => m.author.id === message.author.id, 
                max: 1, 
                time: 300000, 
                errors: ['time'] 
            });
            
            const msg = collected.first();
            if (!msg) throw new Error("Timeout");

            const content = msg.content.trim();
            if (content.toUpperCase() === "CANCELAR") {
                return dmChannel.send("🛑 Criação de ficha cancelada.");
            }

            if (field.isOptional && content.toLowerCase() === "pular") {
                continue;
            }

            // Identificação do Avatar (Se o tipo for Imagem)
            if (field.type === 'image') {
                const imgUrl = msg.attachments.first()?.url || content;
                respostas[field.name] = imgUrl;
                avatarUrl = imgUrl; 
            } else {
                respostas[field.name] = content;
            }

            // Identificação do Nome do Personagem
            const nameKeys = ["nome", "name", "nome do personagem"];
            if (nameKeys.includes(field.name.toLowerCase())) {
                characterName = content;
            }

        } catch (e) {
            return dmChannel.send("⏳ Tempo esgotado (5 minutos de inatividade). Ficha cancelada.");
        }
    }

    // Cria a Ficha como 'Pendente' no banco de dados
    const ficha = await FichaModel.create({
        guildId: message.guildId,
        userId: message.author.id,
        characterName: characterName,
        avatar: avatarUrl,
        data: respostas,
        status: 'pending'
    });

    await dmChannel.send("✅ Ficha concluída! Foi enviada para a administração avaliar.");

    // Manda pro canal de aprovação do servidor
    const approvalChannel = message.client.channels.cache.get(template.approvalChannelId) as TextChannel;
    if (approvalChannel) {
        const embed = new EmbedBuilder()
            .setTitle(`Nova Ficha: ${characterName}`)
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
            .setColor(0xFEE75C)
            .setThumbnail(avatarUrl);

        for (const [key, val] of Object.entries(respostas)) {
            const strVal = String(val);
            if (strVal.startsWith("http")) continue; // Ignora exibir links soltos no embed se já foi pro thumbnail
            embed.addFields({ name: key, value: strVal.substring(0, 1024), inline: true });
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`ficha_approve_${ficha._id}`).setLabel("Aprovar").setStyle(ButtonStyle.Success).setEmoji("✅"),
            new ButtonBuilder().setCustomId(`ficha_reject_${ficha._id}`).setLabel("Rejeitar").setStyle(ButtonStyle.Danger).setEmoji("❌")
        );

        approvalChannel.send({ content: `🔔 <@${message.author.id}> enviou uma ficha para avaliação!`, embeds: [embed], components: [row] });
    }
}