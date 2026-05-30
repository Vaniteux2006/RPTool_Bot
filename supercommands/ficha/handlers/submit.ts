// RPTool/supercommands/ficha/handlers/submit.ts
import { Message } from 'discord.js';
import { TemplateModel } from '../../../tools/models/FichaSchema';

export default async function handleSubmit(message: Message, _args: string[]) {
    if (!message.member?.permissions.has('Administrator')) {
        return message.reply('❌ Apenas administradores podem definir o canal de envio de fichas.');
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
        return message.reply('❌ Mencione o canal corretamente. Ex: `rp!ficha submit #fichas`');
    }

    await TemplateModel.findOneAndUpdate(
        { guildId: message.guildId },
        { submitChannelId: channel.id },
        { upsert: true, new: true }
    );

    return message.reply(
        `✅ Canal de envio de fichas definido para <#${channel.id}>.\n` +
        `Quando alguém postar uma ficha nesse canal, ela será detectada automaticamente e enviada para aprovação.`
    );
}
