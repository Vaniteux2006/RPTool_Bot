import { Message } from 'discord.js';
import { phoneSystem, notifyServer } from '../system';

export default async function handleEnd(message: Message) {
    if (!message.guild) return;
    
    const data = phoneSystem.end_call(message.guild.id);
    
    if ('error' in data) return message.reply(`❌ **Erro:** ${data.error}`);
    
    if (data.status === 'ended') {
        message.reply("🔴 **Ligação Encerrada.**");
        
        if (data.notify_channels) {
            data.notify_channels.forEach((cId: string) => notifyServer(message.client, cId, `🔴 **${message.guild?.name}** desligou.`));
        }
    }
}