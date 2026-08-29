import { Message, MessageCollector, TextChannel } from "discord.js";
import { OCModel } from "../../../tools/models/OCSchema";
import { extractName } from "../utils";

export default async function handlePersona(message: Message, args: string[]) {
    const userId = message.author.id;
    
    // Extrai o nome do OC da mensagem
    const extracted = extractName(message.content, args[0]);
    if (!extracted) {
        return message.reply("⚠️ Qual OC? Uso correto: `rp!oc persona \"Nome\"`");
    }

    // Busca o OC no banco de dados
    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) {
        return message.reply("❌ OC não encontrado.");
    }

    // Inicia o processo de configuração
    await message.reply(`📝 **Configurando IA para ${oc.name}**\nEnvie a PERSONALIDADE do personagem em mensagens separadas ou tudo de uma vez. Digite **END** pra salvar e terminar, ou **CANCEL** pra cancelar.`);
    
    // Coletor de mensagens de 5 minutos (300000ms)
    const channel = message.channel as TextChannel;
    const collector = new MessageCollector(channel, { 
        filter: m => m.author.id === userId, 
        time: 300000 
    });
    
    let personaText = "";
    
    collector.on('collect', m => {
        const text = m.content.trim().toUpperCase();
        if (text === "CANCEL" || text === "CANCELAR") {
            collector.stop("cancelled");
        } else if (text === "END") {
            collector.stop("finished");
        } else {
            personaText += m.content + "\n";
        }
    });
    
    collector.on('end', async (_, reason) => {
        if (reason === "finished") {
            // Salva a nova persona e ativa a IA neste canal
            oc.ai.enabled = true;
            oc.ai.persona = personaText.trim();
            oc.ai.activeChannelId = channel.id; // ativa a sessão NESTE canal
            oc.markModified('ai');
            await oc.save();
            message.reply(`🤖 IA Ativada e configurada com sucesso para **${oc.name}** **neste canal**!`);
        } else if (reason === "cancelled") {
            // Cancelado pelo usuário: nada é salvo, a persona antiga (se houver) fica intacta
            message.reply(`🛑 Configuração cancelada. A IA de **${oc.name}** não foi alterada.`);
        } else {
            // Caso o tempo esgote sem o usuário digitar "END"
            message.reply("⏱️ O tempo limite de 5 minutos para configurar a persona esgotou. Tente novamente.");
        }
    });
}