import { Message } from 'discord.js';
import { phoneSystem } from '../system';

export default async function handleInstall(message: Message, args: string[]) {
    if (!message.guild) return;
    const marker = args[1]; // Ex: rp!phone install [SUL]
    const data = await phoneSystem.register(message.guild.id, message.channel.id, marker);
    message.reply(`☎️ ${data.msg}`);
}