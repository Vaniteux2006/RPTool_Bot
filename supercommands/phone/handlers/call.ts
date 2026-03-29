import { Message } from 'discord.js';
import { phoneSystem } from '../system';

export default async function handleCall(message: Message, args: string[]) {
    if (!message.guild) return;

    // Pega o nome/ID do alvo (Ex: rp!phone call [SUL])
    const targetIdentifier = args[1] ? args.slice(1).join(" ") : "";
    if (!targetIdentifier) return message.reply("❌ Digite para quem quer ligar. Ex: `rp!phone call NomeDoLugar`");

    // Passamos os DOIS argumentos: quem liga e para quem liga
    const data = phoneSystem.call(message.guild.id, targetIdentifier);
    
    if ('error' in data) return message.reply(`❌ **Erro:** ${data.error}`);
    
    if (data.status === 'ringing') {
        message.reply(`📱 **Chamando...** (Aguardando alguém atender)`);
        
        if ('target_channel' in data && data.target_channel) {
            const channel = message.client.channels.cache.get(data.target_channel) as any;
            if (channel) channel.send(`☎️ **TRIM TRIM!** O servidor **${message.guild.name}** está ligando!\nUse \`rp!phone accept\` para atender ou \`rp!phone decline\` para recusar.`);
        }
    } else if ('msg' in data) { // Caso dê ocupado ('busy')
        message.reply(`📱 ${data.msg}`);
    }
}