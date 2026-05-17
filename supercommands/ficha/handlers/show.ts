// RPTool/supercommands/ficha/handlers/show.ts
import { Message } from 'discord.js';
import { TemplateModel } from '../../../tools/models/FichaSchema';

export default async function handleShow(message: Message, args: string[]) {
    if (!message.member?.permissions.has('Administrator')) {
        return message.reply('❌ Apenas administradores podem definir o canal de exibição.');
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
        return message.reply('❌ Mencione o canal corretamente. Ex: `rp!ficha show #personagens`');
    }

    await TemplateModel.findOneAndUpdate(
        { guildId: message.guildId },
        { showChannelId: channel.id },
        { upsert: true, new: true }
    );

    return message.reply(`✅ Canal de exibição definido para <#${channel.id}>.\nPersonagens aprovados e recusados serão exibidos lá.`);
}