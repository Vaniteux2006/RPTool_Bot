import { Message, TextChannel } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';

export default async function handleEdit(message: Message, args: string[], userId: string) {
    const newText = args.slice(1).join(" ");
    if (!newText) return message.reply("Digite o novo texto.");

    const myOCs = await OCModel.find({ adminId: userId });
    const myNames = myOCs.map(t => t.name);
    
    // Busca as últimas 10 mensagens no canal para achar o webhook do OC
    const msgs = await message.channel.messages.fetch({ limit: 10 });
    const target = msgs.find(m => m.webhookId && myNames.includes(m.author.username));

    if (!target) return message.reply("Nenhuma msg recente sua.");
    
    const hooks = await (message.channel as TextChannel).fetchWebhooks();
    const hook = hooks.find(w => w.id === target.webhookId);

    if (hook) {
        await hook.editMessage(target.id, { content: newText });
        message.delete().catch(() => { });
    } else {
        return message.reply("Erro no webhook.");
    }
}