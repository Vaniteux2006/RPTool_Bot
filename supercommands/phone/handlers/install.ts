import { Message } from 'discord.js';
import { phoneSystem } from '../system';

export default async function handleInstall(message: Message, args: string[]) {
    if (!message.guild) return;
    
    const marker = args[1] ? args.slice(1).join(" ") : undefined;
    const data: any = await phoneSystem.register(message.guild.id, message.channel.id, marker);
    
    if (data.error) return message.reply(`❌ **Erro:** ${data.error}`);
    if (data.msg) return message.reply(`📱 ${data.msg}`);
}