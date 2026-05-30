// RPTool/supercommands/ficha/handlers/autodetect.ts
import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel,
} from 'discord.js';
import { TemplateModel, FichaModel } from '../../../tools/models/FichaSchema';

export async function handleAutoDetect(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!message.guildId)   return;

    const template = await TemplateModel.findOne({ guildId: message.guildId });
    if (!template?.submitChannelId)  return;
    if (message.channelId !== template.submitChannelId) return;
    if (!template.fields || template.fields.length === 0) return;
    if (!template.checkChannelId) return;

    // Parse: cada linha no formato "campo: valor" (case-insensitive no campo)
    const lines = message.content.split('\n');
    const parsed = new Map<string, string>();

    for (const line of lines) {
        const sep = line.indexOf(':');
        if (sep === -1) continue;
        const key = line.slice(0, sep).trim();
        const val = line.slice(sep + 1).trim();
        if (key && val) parsed.set(key.toLowerCase(), val);
    }

    // Verifica se algum campo do template foi encontrado na mensagem
    const matchCount = template.fields.filter((f: any) =>
        parsed.has(f.name.toLowerCase())
    ).length;

    // Ignora mensagens que não parecem fichas (menos de metade dos campos)
    if (matchCount < Math.ceil(template.fields.length / 2)) return;

    // Monta respostas, trata imagens e identifica nome/avatar
    const respostas: Record<string, any> = {};
    let avatarUrl     = message.author.displayAvatarURL();
    let characterName = 'Personagem Desconhecido';
    let ocPrefix      = '';

    // Imagem do primeiro anexo da mensagem (campo do tipo image)
    const attachmentUrl = message.attachments.first()?.url ?? null;

    for (const field of template.fields) {
        const kLower = field.name.toLowerCase();
        let value: string | null = parsed.get(kLower) ?? null;

        if (field.type === 'image') {
            // Aceita anexo ou URL no valor
            const candidate = attachmentUrl ?? value ?? '';
            respostas[field.name] = candidate;
            if (candidate) avatarUrl = candidate;
            continue;
        }

        if (!value) continue;

        if (field.type === 'int') {
            const n = parseInt(value);
            respostas[field.name] = isNaN(n) ? value : n;
        } else if (field.type === 'float') {
            const n = parseFloat(value.replace(',', '.'));
            respostas[field.name] = isNaN(n) ? value : n;
        } else if (field.type === 'if') {
            const match = field.options?.find(
                (o: string) => o.toLowerCase() === value!.toLowerCase()
            );
            respostas[field.name] = match ?? value;
        } else {
            respostas[field.name] = value;
        }

        if (field.isName)   characterName = value;
        if (field.isPrefix) ocPrefix      = value;
    }

    // Salva no banco
    const ficha = await FichaModel.create({
        guildId:       message.guildId,
        userId:        message.author.id,
        characterName,
        avatar:        avatarUrl,
        data:          respostas,
        status:        'pending',
        integrateOC:   false,
    });

    // Confirma no canal de envio
    await message.reply('✅ Sua ficha foi enviada para avaliação!');

    // Envia para o canal de aprovação
    const approvalChannel = message.client.channels.cache.get(template.checkChannelId!) as TextChannel;
    if (!approvalChannel) return;

    const embed = new EmbedBuilder()
        .setTitle(`📋 Nova Ficha: ${characterName}`)
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
        .setColor(0xFEE75C)
        .setThumbnail(avatarUrl)
        .setFooter({ text: 'Enviado automaticamente pelo canal de fichas' });

    for (const [key, val] of Object.entries(respostas)) {
        const strVal = String(val);
        if (strVal.startsWith('http')) continue;
        embed.addFields({ name: key, value: strVal.substring(0, 1024), inline: true });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`ficha_approve_${ficha._id}`)
            .setLabel('Aprovar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId(`ficha_reject_${ficha._id}`)
            .setLabel('Rejeitar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌'),
    );

    await approvalChannel.send({
        content: `🔔 <@${message.author.id}> enviou uma ficha para avaliação!`,
        embeds: [embed],
        components: [row],
    });
}
