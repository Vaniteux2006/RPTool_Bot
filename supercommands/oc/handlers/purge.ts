import { Message, TextChannel } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';

export default async function handlePurge(message: Message, args: string[], userId: string) {
    // Quantidade de mensagens para apagar (padrão é 1 se o usuário não especificar)
    let amount = 1;
    if (args[1] && !isNaN(Number(args[1]))) {
        amount = parseInt(args[1]);
    }

    // Limite de segurança para não explodir a API do Discord
    if (amount > 50) amount = 50;

    // Busca os nomes dos OCs do usuário (mesma lógica exata do seu 'edit')
    const myOCs = await OCModel.find({ adminId: userId });
    const myNames = myOCs.map(t => t.name);
    
    // Puxa as últimas 50 mensagens do canal para investigar
    const msgs = await message.channel.messages.fetch({ limit: 50 });
    
    // Filtra apenas as mensagens que são de webhooks E pertencem aos OCs do usuário
    const targetMsgs = msgs.filter(m => m.webhookId && myNames.includes(m.author.username));

    if (targetMsgs.size === 0) {
        return message.reply("📭 Nenhuma mensagem recente dos seus OCs encontrada neste canal.");
    }

    // Isola apenas a quantidade que o usuário pediu para deletar
    const toDelete = Array.from(targetMsgs.values()).slice(0, amount);

    try {
        // Deleta as mensagens encontradas
        for (const msg of toDelete) {
            await msg.delete().catch(() => {});
        }
        
        // Apaga o comando rp!oc purge que o usuário enviou
        message.delete().catch(() => {}); 
        
        // Envia confirmação temporária e apaga após 3 segundos para manter o chat limpo
        const reply = await message.reply(`🗑️ **${toDelete.length}** mensagem(ns) dos seus OCs foram purgadas.`);
        setTimeout(() => { reply.delete().catch(() => {}) }, 3000);

    } catch (error) {
        console.error("Erro no purge:", error);
        return message.reply("❌ Erro interno ao tentar deletar os webhooks.");
    }
}