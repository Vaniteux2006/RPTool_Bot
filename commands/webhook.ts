import { Message, TextChannel, Webhook } from "discord.js";
import { TupperModel, ITupper } from "../models/TupperSchema";

export async function handleTupperMessage(message: Message) {
    if (message.author.bot) return;
    if (!message.guild) return; // Só funciona em servidores

    const content = message.content;
    const myTuppers = await TupperModel.find({
        $or: [
            { adminId: message.author.id },
            { duoIds: message.author.id }
        ]
    });

    if (!myTuppers.length) return;

    // 2. Verifica qual deles deu match no texto
    let match: ITupper | null = null;
    let cleanContent = "";

    // Ordena por tamanho do prefixo (do maior pro menor) pra evitar conflito de "k" e "ka"
    myTuppers.sort((a, b) => b.prefix.length - a.prefix.length);

    for (const tupper of myTuppers) {
        // Lógica de Brackets (Prefixo ... Sufixo)
        const hasPrefix = tupper.prefix ? content.startsWith(tupper.prefix) : true;
        const hasSuffix = tupper.suffix ? content.endsWith(tupper.suffix) : true;

        if (hasPrefix && hasSuffix && (tupper.prefix || tupper.suffix)) {
            match = tupper;
            // Remove prefixo e sufixo
            cleanContent = content.substring(
                tupper.prefix.length, 
                content.length - tupper.suffix.length
            ).trim();
            break; 
        }
    }

    if (!match) return;

    // =========================================================
    // CHECAGEM DE CONFLITO (O MAIS ANTIGO GANHA) 🏆
    // =========================================================
    // Agora checamos se ALGUÉM MAIS no servidor tem esse mesmo prefixo
    // e se o tupper dele é mais velho que o meu.
    
    const conflicts = await TupperModel.find({ 
        prefix: match.prefix, 
        suffix: match.suffix,
        _id: { $ne: match._id } // Não sou eu
    });

    if (conflicts.length > 0) {
        // Filtra: O dono do conflito está nesse servidor?
        const guildMembers = message.guild.members.cache; // Cache rápido
        
        for (const rival of conflicts) {
            // Se o rival tá no server (Admin ou Duo)
            const rivalIsHere = guildMembers.has(rival.adminId) || rival.duoIds.some(id => guildMembers.has(id));
            
            if (rivalIsHere) {
                // Rival está aqui. Quem é mais velho?
                if (rival.createdAt < match.createdAt) {
                    // O rival é mais antigo. Eu perco.
                    console.log(`Conflito: ${match.name} perdeu para ${rival.name} (Mais antigo)`);
                    return; // Não envia nada
                }
            }
        }
    }

    // =========================================================
    // ENVIO DO WEBHOOK
    // =========================================================
    try {
        message.delete().catch(() => {}); // Apaga a msg original

        const channel = message.channel as TextChannel;
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(w => w.owner?.id === message.client.user?.id);

        if (!webhook) {
            webhook = await channel.createWebhook({
                name: 'RPTool Proxy',
                avatar: message.client.user?.displayAvatarURL()
            });
        }

        await webhook.send({
            content: cleanContent,
            username: match.name,
            avatarURL: match.avatar,
            files: Array.from(message.attachments.values()) // Repassa anexos
        });

        // Incrementa contador
        match.messageCount += 1;
        match.save();

    } catch (e) {
        console.error("Erro no webhook:", e);
    }
}