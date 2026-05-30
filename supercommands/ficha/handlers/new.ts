// RPTool/supercommands/ficha/handlers/new.ts
import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel,
} from 'discord.js';
import { TemplateModel, FichaModel } from '../../../tools/models/FichaSchema';

export default async function handleNew(message: Message, args: string[]) {
    // args[0] = 'new', args[1] = '+oc' (opcional)
    const integrateOC = args.includes('+oc');

    const template = await TemplateModel.findOne({ guildId: message.guildId });
    if (!template || !template.fields || template.fields.length === 0) {
        return message.reply('❌ Este servidor não possui uma ficha configurada. Um administrador deve usar `rp!ficha template` primeiro.');
    }
    if (!template.checkChannelId) {
        return message.reply('❌ O canal de aprovação ainda não foi definido. Um administrador deve usar `rp!ficha check #canal`.');
    }

    // Se +oc foi solicitado, garante que o template tem {prefix} e {string_name}
    if (integrateOC) {
        const hasPrefix = template.fields.some((f: any) => f.isPrefix);
        const hasName   = template.fields.some((f: any) => f.isName);
        if (!hasPrefix || !hasName) {
            return message.reply(
                '❌ Para usar `+oc`, o modelo de ficha precisa ter os campos `{string_name}` e `{prefix}`.\n' +
                'Peça ao administrador para atualizar o modelo com `rp!ficha template`.'
            );
        }
    }

    // Abre DM
    let dmChannel;
    try {
        dmChannel = await message.author.createDM();
        await dmChannel.send(
            `📝 **Iniciando sua ficha para o servidor **${message.guild?.name}**!**\n` +
            `Responda cada campo com uma nova mensagem.\n` +
            `Digite **CANCELAR** a qualquer momento para parar.`
        );
        await message.reply('📬 Te enviei uma mensagem na DM! Vamos preencher sua ficha por lá.');
    } catch {
        return message.reply('❌ Não consigo te enviar DM. Verifique se suas DMs estão abertas para este servidor.');
    }

    const respostas: Record<string, any> = {};
    let avatarUrl     = 'https://cdn.discordapp.com/embed/avatars/0.png';
    let characterName = 'Personagem Desconhecido';
    let ocPrefix      = '';

    for (const field of template.fields) {
        // Monta a pergunta
        let question = `**${field.name}**`;

        if (field.type === 'if') {
            question += `\n> Opções válidas: ${field.options.map((o: string) => `\`${o}\``).join(', ')}`;
        } else if (field.type === 'image') {
            question += `\n> Envie uma imagem ou um link de imagem.`;
        } else if (field.type === 'int') {
            question += `\n> Envie um número inteiro.`;
        } else if (field.type === 'float') {
            question += `\n> Envie um número (pode ter decimal, ex: 1.75).`;
        } else if (field.type === 'prefix') {
            question += `\n> Este será o prefixo do webhook do personagem (ex: \`João:\`).`;
        }

        await dmChannel.send(question);

        try {
            const collected = await dmChannel.awaitMessages({
                filter: (m: Message) => m.author.id === message.author.id,
                max: 1,
                time: 300_000,
                errors: ['time'],
            });

            const msg     = collected.first()!;
            const content = msg.content.trim();

            if (content.toUpperCase() === 'CANCELAR') {
                return dmChannel.send('🛑 Criação de ficha cancelada.');
            }

            // ── Validações de tipo ──
            if (field.type === 'int') {
                if (!/^-?\d+$/.test(content)) {
                    await dmChannel.send(`⚠️ O campo **${field.name}** exige um número inteiro. Tente novamente.`);
                    // Re-pergunta este campo
                    const retry = await dmChannel.awaitMessages({
                        filter: (m: Message) => m.author.id === message.author.id,
                        max: 1,
                        time: 120_000,
                        errors: ['time'],
                    });
                    const retryContent = retry.first()!.content.trim();
                    if (!/^-?\d+$/.test(retryContent)) {
                        return dmChannel.send('🛑 Valor inválido novamente. Ficha cancelada.');
                    }
                    respostas[field.name] = parseInt(retryContent);
                    continue;
                }
                respostas[field.name] = parseInt(content);
                continue;
            }

            if (field.type === 'float') {
                const parsed = parseFloat(content.replace(',', '.'));
                if (isNaN(parsed)) {
                    return dmChannel.send(`❌ O campo **${field.name}** exige um número decimal. Ficha cancelada.`);
                }
                respostas[field.name] = parsed;
                continue;
            }

            if (field.type === 'if') {
                const match = field.options.find(
                    (o: string) => o.toLowerCase() === content.toLowerCase()
                );
                if (!match) {
                    return dmChannel.send(
                        `❌ Opção inválida para **${field.name}**.\n` +
                        `Opções: ${field.options.join(', ')}\nFicha cancelada.`
                    );
                }
                respostas[field.name] = match;
                continue;
            }

            if (field.type === 'image') {
                const imgUrl = msg.attachments.first()?.url || content;
                respostas[field.name] = imgUrl;
                avatarUrl = imgUrl;
                continue;
            }

            // string / prefix
            respostas[field.name] = content;

            if (field.isName)   characterName = content;
            if (field.isPrefix) ocPrefix      = content;

        } catch {
            return dmChannel.send('⏳ Tempo esgotado (5 minutos de inatividade). Ficha cancelada.');
        }
    }

    // ── Salva no banco ──
    const ficha = await FichaModel.create({
        guildId: message.guildId,
        userId: message.author.id,
        characterName,
        avatar: avatarUrl,
        data: respostas,
        status: 'pending',
        integrateOC,
    });

    await dmChannel.send('✅ Ficha concluída! Foi enviada para a administração avaliar.');

    // ── Envia para o canal de aprovação ──
    const approvalChannel = message.client.channels.cache.get(template.checkChannelId!) as TextChannel;
    if (!approvalChannel) return;

    const embed = new EmbedBuilder()
        .setTitle(`📋 Nova Ficha: ${characterName}`)
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
        .setColor(0xFEE75C)
        .setThumbnail(avatarUrl)
        .setFooter({ text: integrateOC ? '🔗 +OC habilitado — aprovação criará webhook automaticamente' : '' });

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