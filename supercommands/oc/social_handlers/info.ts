import { Message, EmbedBuilder } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleInfo(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc info \"NomeOC\"`");

    // Permite que você ou alguém do Duo veja a Info
    const oc = await OCModel.findOne({
        $or: [{ adminId: userId }, { duoIds: userId }],
        name: extracted.name
    });
    
    if (!oc) return message.reply("❌ OC não encontrado.");

    const created = oc.createdAt ? oc.createdAt.toLocaleDateString('pt-BR') : "Desconhecido";
    const bday = oc.realBirthday ? `${oc.realBirthday.getDate()}/${oc.realBirthday.getMonth() + 1}` : "Não definido";
    const aiStatus = oc.ai?.enabled ? "Ligada 🟢" : "Desligada 🔴";

    const embed = new EmbedBuilder()
        .setTitle(`📌 Info: ${oc.name}`)
        .setColor(0x00FFFF)
        .setThumbnail(oc.avatar || null)
        .addFields(
            { name: "🗣️ Padrão", value: `\`${oc.prefix || ""}text${oc.suffix || ""}\``, inline: true },
            { name: "💬 Mensagens", value: `${oc.messageCount || 0}`, inline: true },
            { name: "📂 Grupo", value: `${oc.group || "Nenhum"}`, inline: true },
            { name: "🤖 IA", value: aiStatus, inline: true },
            { name: "🎂 Aniversário", value: bday, inline: true },
            { name: "📅 Criado em", value: created, inline: true }
        );

    if (oc.duoIds && oc.duoIds.length > 0) {
        embed.addFields({ name: "🤝 Compartilhado (Duo)", value: oc.duoIds.map((id: string) => `<@${id}>`).join(", ") });
    }

    return message.reply({ embeds: [embed] });
}