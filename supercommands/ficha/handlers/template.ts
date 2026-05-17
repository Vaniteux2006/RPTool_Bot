// RPTool/supercommands/ficha/handlers/template.ts
import { Message, MessageCollector, TextChannel } from 'discord.js';
import { TemplateModel } from '../../../tools/models/FichaSchema';

/*
 * SINTAXE DO TEMPLATE
 * ──────────────────────────────────────────────────────
 * Campo: {tipo}
 * Campo: {tipo} | if (Opção A), (Opção B), (Opção C)
 *
 * Tipos disponíveis:
 *   {string}      → texto livre
 *   {string_name} → texto livre + marca este campo como NOME do personagem
 *   {int}         → número inteiro
 *   {float}       → número decimal
 *   {anex}        → imagem (URL ou anexo) — marca como AVATAR do personagem
 *   {prefix}      → prefixo do webhook (obrigatório se usar rp!ficha new +oc)
 *
 * Exemplos:
 *   Nome: {string_name}
 *   Idade: {int}
 *   Altura: {float}
 *   Gênero: {int} | if (Homem), (Mulher), (Nenhum)
 *   Aparência: {anex}
 *   Prefixo: {prefix}
 * ──────────────────────────────────────────────────────
 */

function compilarTemplate(rawText: string): { fields: any[]; ocPrefixLabel: string | null } {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);
    const fields: any[] = [];
    let ocPrefixLabel: string | null = null;

    for (const line of lines) {
        // Divide em "Nome do Campo" e "regras"
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const name  = line.slice(0, colonIdx).trim();
        const rules = line.slice(colonIdx + 1).trim();

        if (!name || !rules) continue;

        // ── Detectar tipo dentro de {chaves} ──
        const typeMatch = rules.match(/\{(\w+)\}/);
        if (!typeMatch) continue;

        const rawType = typeMatch[1].toLowerCase();

        let type: string;
        let isName  = false;
        let isAvatar = false;
        let isPrefix = false;

        switch (rawType) {
            case 'string_name':
                type   = 'string';
                isName = true;
                break;
            case 'string':
                type = 'string';
                break;
            case 'int':
                type = 'int';
                break;
            case 'float':
                type = 'float';
                break;
            case 'anex':
                type     = 'image';
                isAvatar = true;
                break;
            case 'prefix':
                type     = 'prefix';
                isPrefix = true;
                break;
            default:
                type = 'string';
        }

        if (isPrefix) ocPrefixLabel = name;

        // ── Detectar opções: | if (A), (B), (C) ──
        let options: string[] = [];
        const ifMatch = rules.match(/\|\s*if\s+(.*)/i);
        if (ifMatch) {
            // Captura conteúdo dentro de parênteses: (Algo)
            const raw = ifMatch[1];
            const parenMatches = [...raw.matchAll(/\(([^)]+)\)/g)];
            if (parenMatches.length > 0) {
                options = parenMatches.map(m => m[1].trim());
            } else {
                // Fallback: separado por vírgula sem parênteses
                options = raw.split(',').map(o => o.trim()).filter(Boolean);
            }
        }

        // Se tem opções, força tipo para 'if' (misto é válido ex: {int} | if ...)
        const finalType = options.length > 0 ? 'if' : type;

        fields.push({ name, type: finalType, baseType: type, isName, isAvatar, isPrefix, options });
    }

    return { fields, ocPrefixLabel };
}

export default async function handleTemplate(message: Message, args: string[]) {
    if (!message.member?.permissions.has('Administrator')) {
        return message.reply('❌ Apenas administradores podem configurar o modelo de ficha do servidor.');
    }

    await message.reply(
        '📝 **Criando Modelo de Ficha**\n' +
        'Envie o modelo em **uma única mensagem**, no formato:\n' +
        '```\n' +
        'Campo: {tipo}\n' +
        'Campo: {tipo} | if (Opção A), (Opção B)\n' +
        '```\n' +
        '**Tipos:** `{string}` `{string_name}` `{int}` `{float}` `{anex}` `{prefix}`\n' +
        '> `{string_name}` marca o campo como nome do personagem\n' +
        '> `{anex}` marca o campo como imagem/avatar\n' +
        '> `{prefix}` é necessário para `rp!ficha new +oc`\n\n' +
        'Digite **CANCELAR** para cancelar.'
    );

    const collector = new MessageCollector(message.channel as TextChannel, {
        filter: m => m.author.id === message.author.id,
        time: 300_000,
        max: 1,
    });

    collector.on('collect', async (m) => {
        if (m.content.toUpperCase() === 'CANCELAR') {
            return message.reply('🛑 Operação cancelada.');
        }

        const { fields, ocPrefixLabel } = compilarTemplate(m.content);

        if (fields.length === 0) {
            return message.reply(
                '❌ Nenhum campo válido encontrado.\n' +
                'Certifique-se de usar o formato `NomeCampo: {tipo}` (ex: `Idade: {int}`).'
            );
        }

        await TemplateModel.findOneAndUpdate(
            { guildId: message.guildId },
            {
                guildId: message.guildId,
                rawText: m.content,
                fields,
                ocPrefixLabel,
            },
            { upsert: true, new: true }
        );

        const fieldList = fields.map((f, i) => {
            let info = f.type === 'if' ? ` → Escolha: ${f.options.join(', ')}` : '';
            let tag  = '';
            if (f.isName)   tag += ' 🏷️nome';
            if (f.isAvatar) tag += ' 🖼️avatar';
            if (f.isPrefix) tag += ' 🔗prefix';
            return `${i + 1}. **${f.name}**${tag}${info}`;
        }).join('\n');

        await message.reply(
            `✅ **Modelo registrado com ${fields.length} campo(s):**\n${fieldList}\n\n` +
            `📌 Use \`rp!ficha check #canal\` para definir onde as fichas serão enviadas para aprovação.\n` +
            `📌 Use \`rp!ficha show #canal\` para definir onde as aprovações/recusas serão exibidas.`
        );
    });

    collector.on('end', (_, reason) => {
        if (reason === 'time') message.reply('⏳ Tempo esgotado. Operação cancelada.');
    });
}