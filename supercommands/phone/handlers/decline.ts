import { Message } from 'discord.js';
import { phoneSystem, notifyServer } from '../system';

export default async function handleDecline(message: Message) {
    if (!message.guild) return;
    
    const data: any = phoneSystem.decline(message.guild.id); 
    
    if (data.error) return message.reply(`❌ **Erro:** ${data.error}`);

    if (data.status === 'declined') {
        message.reply("🚫 **Chamada Recusada.**");
        if (data.target_channel) {
            notifyServer(message.client, data.target_channel, `🚫 **${message.guild.name}** recusou a chamada.`);
        }
    } else if (data.msg) {
        message.reply(`📱 ${data.msg}`);
    }
}