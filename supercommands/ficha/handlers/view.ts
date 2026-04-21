// RPTool/supercommands/ficha/handlers/view.ts
import { Message, EmbedBuilder } from "discord.js";
import { TemplateModel } from "../../../tools/models/FichaSchema";

export default async function handleView(message: Message, args: string[]) {
    const template = await TemplateModel.findOne({ guildId: message.guildId });
    if (!template || !template.fields || template.fields.length === 0) {
        return message.reply("❌ Este servidor ainda não tem um modelo de ficha configurado. Use `rp!ficha template`.");
    }

    const embed = new EmbedBuilder()
        .setTitle(`📋 Modelo de Ficha: ${message.guild?.name}`)
        .setColor(0x2B2D31)
        .setDescription(`As fichas preenchidas serão enviadas para <#${template.approvalChannelId}>.`);

    let desc = "";
    template.fields.forEach((f: any, i: number) => {
        const opt = f.isOptional ? "*(Opcional)*" : "**(Obrigatório)**";
        let ruleInfo = "";
        
        if (f.type === "int") ruleInfo = " [Número Inteiro]";
        if (f.type === "float") ruleInfo = " [Número Decimal]";
        if (f.type === "image") ruleInfo = " [Link de Imagem]";
        if (f.type === "if") ruleInfo = ` [Escolha: ${f.options.join(", ")}]`;

        desc += `${i + 1}. **${f.name}** ${opt}${ruleInfo}\n`;
    });

    embed.addFields({ name: "Campos Exigidos", value: desc });
    
    return message.reply({ embeds: [embed] });
}