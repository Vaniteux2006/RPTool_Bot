import { Message } from 'discord.js';
import { phoneSystem } from '../system';

export default async function handleUninstall(message: Message) {
    if (!message.guild) return;
    const data = await phoneSystem.turn_off(message.guild.id);
    message.reply(`📴 ${data.msg}`);
}