import { Message } from 'discord.js';
import { phoneSystem, notifyServer } from '../system';

export default async function handleAccept(message: Message) {
    if (!message.guild) return;
    
    const data = phoneSystem.accept(message.guild.id);
    
    // Usamos 'error' in data para o TypeScript entender que é seguro ler
    if ('error' in data) return message.reply(`❌ **Erro:** ${data.error}`);
    
    if (data.status === 'connected') {
        message.reply("🟢 **Ligação Conectada!**");
        
        if (data.partners) {
            data.partners.forEach((cId: string) => notifyServer(message.client, cId, `🟢 **${message.guild?.name}** atendeu!`));
        }
    }
}