// RPTool/supercommands/ficha/handlers/view.ts
import { Message, EmbedBuilder } from 'discord.js';
import { TemplateModel } from '../../../tools/models/FichaSchema';

const TYPE_LABEL: Record<string, string> = {
    string: 'Texto',
    int:    'Número inteiro',
    float:  'Número decimal',
    image:  'Imagem / Anexo',
    prefix: 'Prefixo do webhook',
    if:     'Escolha',
};

export default async function handleView(message: Message, args: string[]) {
    const template = await TemplateModel.findOne({ guildId: message.guildId });
    if (!template || !template.fields || template.fields.length === 0) {
        return message.reply('❌ Este servidor ainda não tem um modelo de ficha. Use `rp!ficha template`.');
    }

    const embed = new EmbedBuilder()
        .setTitle(`📋 Modelo de Ficha — ${message.guild?.name}`)
        .setColor(0x2B2D31);

    // Info de canais
    const checkInfo  = template.checkChannelId  ? `<#${template.checkChannelId}>`  : '*(não definido — use `rp!ficha check #canal`)*';
    const showInfo   = template.showChannelId   ? `<#${template.showChannelId}>`   : '*(não definido — use `rp!ficha show #canal`)*';
    const submitInfo = (template as any).submitChannelId ? `<#${(template as any).submitChannelId}>` : '*(não definido — use `rp!ficha submit #canal`)*';

    embed.setDescription(
        `**Canal de aprovação:** ${checkInfo}\n` +
        `**Canal de exibição:** ${showInfo}\n` +
        `**Canal de envio direto:** ${submitInfo}`
    );

    // Lista de campos
    let fieldDesc = '';
    template.fields.forEach((f: any, i: number) => {
        let tags = '';
        if (f.isName)   tags += ' 🏷️';
        if (f.isAvatar) tags += ' 🖼️';
        if (f.isPrefix) tags += ' 🔗';

        let extra = TYPE_LABEL[f.type] ?? f.type;
        if (f.type === 'if' && f.options?.length) {
            extra += `: ${f.options.join(', ')}`;
        }

        fieldDesc += `\`${i + 1}.\` **${f.name}**${tags} — *${extra}*\n`;
    });

    embed.addFields({ name: `Campos (${template.fields.length})`, value: fieldDesc });

    return message.reply({ embeds: [embed] });
}