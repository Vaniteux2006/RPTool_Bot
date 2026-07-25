import { Message, EmbedBuilder } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';

// Escapa metacaracteres para o termo digitado virar busca literal (evita regex quebrada)
function escapeRegex(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default async function handleFind(message: Message, args: string[]) {
    // Busca global: monta o termo direto dos args para funcionar com qualquer alias (oc, tul, char...)
    const searchTerm = args.slice(1).join(" ").replace(/^["'`]|["'`]$/g, "").trim();

    if (!searchTerm) return message.reply("Quem você quer achar? `rp!oc find \"Nome\"`");

    // Diferente do `info`, o find procura em TODA a base, não só nos OCs do membro
    const ocs = await OCModel.find({
        name: { $regex: escapeRegex(searchTerm), $options: "i" }
    }).limit(5);

    if (ocs.length === 0) return message.reply(`❌ Nenhum OC encontrado com **"${searchTerm}"**.`);

    if (ocs.length > 1) {
        const list = ocs.map(oc => `• **${oc.name}** (Dono: <@${oc.adminId}>)`).join("\n");
        return message.reply(`🔍 Encontrei vários:\n${list}\n*Seja mais específico!*`);
    }

    const oc = ocs[0];

    let ownerName = `<@${oc.adminId}>`;
    try {
        const user = await message.client.users.fetch(oc.adminId);
        ownerName = `${user.username} (\`${user.id}\`)`;
    } catch (e) { }

    const created = oc.createdAt ? oc.createdAt.toLocaleDateString('pt-BR') : "Desconhecido";
    const bday = oc.realBirthday ? `${oc.realBirthday.getDate()}/${oc.realBirthday.getMonth() + 1}` : "Não definido";
    const aiStatus = oc.ai?.enabled ? "✅ Ativa" : "❌ Desligada";

    const embed = new EmbedBuilder()
        .setTitle(`🔎 Ficha de: ${oc.name}`)
        .setColor(0x00FF00)
        .setThumbnail(oc.avatar || null)
        .setImage(oc.avatar || null)
        .addFields(
            { name: "👑 Dono", value: ownerName, inline: true },
            { name: "💬 Padrão", value: `\`${oc.prefix || ""}text${oc.suffix || ""}\``, inline: true },
            { name: "📊 Mensagens", value: `${oc.messageCount || 0}`, inline: true },
            { name: "📂 Grupo", value: oc.group || "Nenhum", inline: true },
            { name: "📅 Criado em", value: created, inline: true },
            { name: "🎂 Aniversário", value: bday, inline: true },
            { name: "🤖 Status IA", value: aiStatus, inline: true }
        );

    return message.reply({ embeds: [embed] });
}
