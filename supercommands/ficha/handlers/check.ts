// RPTool/supercommands/ficha/handlers/check.ts
import { Message } from 'discord.js';
import { TemplateModel } from '../../../tools/models/FichaSchema';

export default async function handleCheck(message: Message, args: string[]) {
    if (!message.member?.permissions.has('Administrator')) {
        return message.reply('❌ Apenas administradores podem definir o canal de aprovação.');
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
        return message.reply('❌ Mencione o canal corretamente. Ex: `rp!ficha check #aprovações`');
    }

    await TemplateModel.findOneAndUpdate(
        { guildId: message.guildId },
        { checkChannelId: channel.id },
        { upsert: true, new: true }
    );

    return message.reply(`✅ Canal de aprovação de fichas definido para <#${channel.id}>.\nAs fichas enviadas pelos usuários aparecerão lá para revisão.`);
}