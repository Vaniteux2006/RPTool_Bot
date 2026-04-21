// RPTool/supercommands/ficha/handlers/template.ts
import { Message, MessageCollector, TextChannel } from "discord.js";
import { TemplateModel } from "../../../tools/models/FichaSchema";

function compilarTemplate(rawText: string) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);
    const fields = [];
    let ocPrefixLabel = null;

    for (const line of lines) {
        if (!line.includes(':')) continue;
        
        const [namePart, ...ruleParts] = line.split(':');
        const name = namePart.trim();
        const rules = ruleParts.join(':').trim(); 
        
        const isOptional = rules.includes('|maynot|');
        const isPrefix = rules.includes('|prefix|');
        
        if (isPrefix) ocPrefixLabel = name;
        
        let type = "string";
        if (rules.includes('|int|')) type = "int";
        else if (rules.includes('|float|')) type = "float";
        else if (rules.includes('|image|')) type = "image";
        else if (rules.includes('|if|')) type = "if";

        let options: any[] = [];
        
        if (type === "if") {
            const ifContent = rules.split('|if|')[1].replace(/\|maynot\||\|prefix\|/g, "").trim();
            options = ifContent.split(',').map(o => o.trim());
        }

        fields.push({ name, type, isOptional, options });
    }

    return { fields, ocPrefixLabel };
}

export default async function handleTemplate(message: Message, args: string[]) {
    if (!message.member?.permissions.has('Administrator')) {
        return message.reply("❌ Apenas administradores podem configurar o modelo de ficha do servidor.");
    }

    message.reply("📝 **Criando Modelo de Ficha**\nEnvie o modelo seguindo o formato:\n`NomeCampo: regras` (ex: `Idade: |int|`).\nRegras disponíveis: `|maynot|`, `|prefix|`, `|int|`, `|float|`, `|image|`, `|if| opt1, opt2`.\n\nDigite o modelo inteiro em UMA MENSAGEM. Digite **CANCEL** para cancelar.");

    const collector = new MessageCollector(message.channel as TextChannel, {
        filter: m => m.author.id === message.author.id,
        time: 300000,
        max: 1
    });

    collector.on('collect', async (m) => {
        if (m.content.toUpperCase() === 'CANCEL') {
            message.reply("🛑 Operação cancelada.");
            return;
        }

        const { fields, ocPrefixLabel } = compilarTemplate(m.content);

        if (fields.length === 0) {
            message.reply("❌ Nenhum campo válido encontrado com o formato `Nome: regra`.");
            return;
        }

        message.reply("✅ Modelo lido! Agora, **mencione o canal** onde as fichas preenchidas serão enviadas para aprovação (ex: <#123456789>).");

        const channelCollector = new MessageCollector(message.channel as TextChannel, {
            filter: msg => msg.author.id === message.author.id,
            time: 60000,
            max: 1
        });

        channelCollector.on('collect', async (cMsg) => {
            const channelId = cMsg.mentions.channels.first()?.id;
            if (!channelId) {
                message.reply("❌ Canal inválido. Configuração cancelada.");
                return;
            }

            await TemplateModel.findOneAndUpdate(
                { guildId: message.guildId },
                {
                    guildId: message.guildId,
                    fields,
                    approvalChannelId: channelId,
                    integrateOC: true,
                    ocPrefixLabel
                },
                { upsert: true, new: true }
            );

            message.reply(`🎉 Modelo de ficha criado com sucesso! As avaliações ocorrerão em <#${channelId}>.`);
        });
    });
}