import { Message } from 'discord.js';
import { phoneSystem } from '../system';

export default async function handleDecline(message: Message) {
    if (!message.guild) return;
    // (Ajuste caso o seu método na classe seja recuse() ou decline())
    const data = await phoneSystem.decline(message.guild.id); 
    
    if (data.status === 'declined') {
        message.reply("🚫 **Chamada Recusada.**");
        
        if (data.target_channel) {
            const channel = message.client.channels.cache.get(data.target_channel) as any;
            if (channel) channel.send(`🚫 **${message.guild?.name}** recusou a chamada.`);
        }
    } else if (data.msg) {
        message.reply(`📱 ${data.msg}`);
    }
}