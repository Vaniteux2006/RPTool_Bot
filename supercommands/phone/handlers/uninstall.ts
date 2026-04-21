import { Message } from 'discord.js';
import { phoneSystem } from '../system';

export default async function handleUninstall(message: Message) {
    if (!message.guild) return;
    
    const data: any = await phoneSystem.turn_off(message.guild.id);
    
    if (data.error) return message.reply(`❌ **Erro:** ${data.error}`);
    if (data.msg) return message.reply(`📱 ${data.msg}`);
}