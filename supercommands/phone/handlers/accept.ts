import { Message } from 'discord.js';
import { phoneSystem, notifyServer } from '../system';

export default async function handleAccept(message: Message) {
    if (!message.guild) return;
    
    const data: any = phoneSystem.accept(message.guild.id);
    
    if (data.error) return message.reply(`❌ **Erro:** ${data.error}`);
    
    if (data.status === 'connected') {
        message.reply("🟢 **Ligação Conectada!**");
        if (data.partners) {
            data.partners.forEach((cId: string) => notifyServer(message.client, cId, `🟢 **${message.guild.name}** atendeu!`));
        }
    } else if (data.msg) {
        message.reply(`📱 ${data.msg}`);
    }
}