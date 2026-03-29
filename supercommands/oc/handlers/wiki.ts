import { Message, TextChannel, MessageCollector } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleWiki(message: Message, args: string[], userId: string) {
    const subAction = args[1]?.toLowerCase();
    const validSubs = ["add", "edit", "remove", "extra", "ref", "intro", "bio", "emoji"];

    if (!validSubs.includes(subAction)) {
        return message.reply("⚠️ Uso: `rp!oc wiki <add|edit|remove|extra|ref|intro|emoji> \"NomeOC\"`");
    }

    const extracted = extractName(message.content, subAction);
    if (!extracted) return message.reply(`⚠️ Faltou o nome do OC. Uso: \`rp!oc wiki ${subAction} "NomeOC"\``);

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    if (!oc.wiki) {
        oc.wiki = { bio: "", extras: new Map(), sections: [], references: [] };
    }

    // 📝 1. Lógica para INTRO / BIO
    if (subAction === "intro" || subAction === "bio") {
        await message.reply(`📝 **Escrevendo a Introdução de ${oc.name}**\nEnvie a biografia agora no chat (Você tem 5 minutos). Pode enviar em várias mensagens!\nQuando terminar, digite \`END\` para salvar, ou \`cancelar\` para abortar.`);
        
        // Forçando o tipo para o TypeScript ficar quieto
        const channel = message.channel as TextChannel;

        // Repare que tiramos o "max: 1" para ele ouvir sem parar
        const collector = channel.createMessageCollector({ 
            filter: (m: Message) => m.author.id === userId, 
            time: 300000 
        });

        let bioText = ""; // Variável para acumular a história

        collector.on('collect', async (m) => {
            const texto = m.content.trim();

            if (texto.toLowerCase() === 'cancelar') {
                collector.stop('cancelado');
                m.reply("🛑 Operação cancelada.");
                return;
            }

            if (texto.toUpperCase() === 'END') {
                collector.stop('finalizado');
                return;
            }

            // Acumula a mensagem e dá duas quebras de linha para separar os parágrafos bonitinho
            bioText += texto + "\n\n";
        });

        // O evento 'end' dispara quando o collector.stop() é chamado ou o tempo acaba
        collector.on('end', async (collected, reason) => {
            if (reason === 'finalizado') {
                // Remove os espaços e quebras de linha sobrando no final
                oc.wiki.bio = bioText.trim();
                oc.markModified('wiki');
                await oc.save();
                message.reply(`✅ Biografia de **${oc.name}** atualizada com sucesso e salva!`);
            } else if (reason === 'time') {
                message.reply(`⏳ Tempo esgotado (5 minutos). A biografia não foi salva.`);
            }
        });

        return;
    }

    // 📌 2. Lógica para EXTRA
    if (subAction === "extra") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))\s+("([^"]+)"|'([^']+)'|`([^`]+)`|(.+))/);
        if (!match) return message.reply("⚠️ Uso: `rp!oc wiki extra \"NomeOC\" \"Chave\" \"Valor\"` (ou use `remove` no valor)");

        const key = match[2] || match[3] || match[4] || match[5];
        const value = match[7] || match[8] || match[9] || match[10];

        if (!oc.wiki.extras) oc.wiki.extras = new Map();

        if (value.toLowerCase() === "remove") {
            oc.wiki.extras.delete(key);
            message.reply(`🗑️ Extra **${key}** removido.`);
        } else {
            oc.wiki.extras.set(key, value);
            message.reply(`✅ Extra **${key}** definido como: ${value}`);
        }

        oc.markModified('wiki');
        await oc.save();
        return;
    }

    // 🔗 3. Lógica para REF
    if (subAction === "ref") {
        const match = extracted.rest.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))/);
        if (!match) return message.reply("⚠️ Uso: `rp!oc wiki ref \"NomeOC\" \"NomeDaReferencia\"`");
        const refName = match[2] || match[3] || match[4] || match[5];

        if (!oc.wiki.references) oc.wiki.references = [];

        if (oc.wiki.references.includes(refName)) {
            oc.wiki.references = oc.wiki.references.filter(r => r !== refName);
            message.reply(`🔗 Referência **${refName}** removida de ${oc.name}.`);
        } else {
            oc.wiki.references.push(refName);
            message.reply(`🔗 Referência **${refName}** adicionada a ${oc.name}.`);
        }

        oc.markModified('wiki');
        await oc.save();
        return;
    }

    // As demais lógicas (add, edit, remove, emoji) seguem a mesma estrutura pesada de Regex/Coletores.
    message.reply("⚙️ Módulo wiki acessado (Outras funções ainda precisam ser engatilhadas).");
}