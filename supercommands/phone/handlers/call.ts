import { Message } from 'discord.js';
import { phoneSystem, notifyServer } from '../system';

export default async function handleCall(message: Message, args: string[]) {
    if (!message.guild) return;

    const data: any = phoneSystem.call(message.guild.id, args.slice(1).join(" "));
    
    if (data.error) return message.reply(`❌ **Erro:** ${data.error}`);
    
    if (data.status === 'ringing') {
        message.reply(`📞 **Chamando...**`);
        if (data.target_channel) {
            notifyServer(message.client, data.target_channel, `📞 **TRIM TRIM!** O servidor **${message.guild.name}** está ligando!\nDigite \`/phone accept\` para atender.`);
        }
    } else if (data.msg) {
        message.reply(`📱 ${data.msg}`);
    }
}