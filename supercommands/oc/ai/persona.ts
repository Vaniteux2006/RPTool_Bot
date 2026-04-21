import { Message, MessageCollector, TextChannel } from "discord.js";
import { OCModel } from "../../../tools/models/OCSchema";
import { extractName } from "../../../tools/utils/textUtils";

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
    await message.reply(`📝 **Configurando IA para ${oc.name}**\nEnvie a PERSONALIDADE do personagem em mensagens separadas ou tudo de uma vez. Digite **END** pra salvar e terminar.`);
    
    // Coletor de mensagens de 5 minutos (300000ms)
    const channel = message.channel as TextChannel;
    const collector = new MessageCollector(channel, { 
        filter: m => m.author.id === userId, 
        time: 300000 
    });
    
    let personaText = "";
    
    collector.on('collect', m => {
        if (m.content.trim().toUpperCase() === "END") {
            collector.stop("finished");
        } else {
            personaText += m.content + "\n";
        }
    });
    
    collector.on('end', async (_, reason) => {
        if (reason === "finished") {
            // Salva a nova persona e ativa a IA
            oc.ai.enabled = true;
            oc.ai.persona = personaText.trim();
            await oc.save();
            message.reply(`🤖 IA Ativada e configurada com sucesso para **${oc.name}**!`);
        } else {
            // Caso o tempo esgote sem o usuário digitar "END"
            message.reply("⏱️ O tempo limite de 5 minutos para configurar a persona esgotou. Tente novamente.");
        }
    });
}