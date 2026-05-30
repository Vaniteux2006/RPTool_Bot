// RPTool/supercommands/logs/events/Messagelogs.ts
// ─── Log de Mensagens ─────────────────────────────────────────────────────────
// Intents: GUILD_MESSAGES (1<<9) + MESSAGE_CONTENT (1<<15) ⚠️ privileged
// Referências visuais: imagem 1 (edit), imagem 4 (bulk delete)

import {
    Message, PartialMessage, Collection, Snowflake,
    AuditLogEvent, EmbedBuilder, GuildMember,
} from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, truncate } from '../utils/LogMinister';
import { buildAttachments } from '../../../tools/HtmlTranscript';

// ─── Message Update — edição (imagem 1) ──────────────────────────────────────
EventCheckout.onMessageUpdate('logs:messageUpdate', async (
    oldMsg: Message | PartialMessage,
    newMsg: Message | PartialMessage,
) => {
    if (!newMsg.guildId || newMsg.author?.bot) return;
    // Embed updates (preview de link, pin) não têm mudança de conteúdo
    if (oldMsg.content === newMsg.content) return;

    const lm = await LogMinister.for(newMsg.guild!);
    if (!lm || !lm.allows('messages')) return;

    const author      = newMsg.author ?? oldMsg.author;
    const channelName = newMsg.channel.isDMBased()
        ? 'DM'
        : `#${(newMsg.channel.isTextBased() && "name" in newMsg.channel ? newMsg.channel.name : newMsg.channelId)}`;

    const prevContent = oldMsg.partial
        ? '*(não estava em cache)*'
        : truncate(oldMsg.content || '*(vazio)*');
    const newContent  = truncate(newMsg.content || '*(vazio)*');

    const embed = new EmbedBuilder()
        .setColor(LogColor.warn)
        .setAuthor({
            name:    author?.tag ?? 'Desconhecido',
            iconURL: author?.displayAvatarURL({ size: 64 }) ?? undefined,
        })
        .setDescription(
            `**${author?.tag ?? 'Alguém'}** editou uma mensagem em ${channelName}.\n` +
            `[Ir para a mensagem](${newMsg.url})`,
        )
        .addFields(
            { name: 'Canal',  value: `<#${newMsg.channelId}>` },
            { name: 'Agora',  value: newContent  },
            { name: 'Antes',  value: prevContent },
        )
        .addFields({
            name:  '\u200B',
            value: idBlock({ User: author?.id ?? '?', Message: newMsg.id }),
        })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Message Delete — deleção simples ────────────────────────────────────────
EventCheckout.onMessageDelete('logs:messageDelete', async (msg: Message | PartialMessage) => {
    if (!msg.guildId || msg.author?.bot) return;

    const lm = await LogMinister.for(msg.guild!);
    if (!lm || !lm.allows('messages')) return;

    const author  = msg.author;
    const content = msg.partial
        ? '*(não estava em cache)*'
        : truncate(msg.content || '*(sem conteúdo de texto)*');

    const idEntries: Record<string, string> = { User: author?.id ?? '?' };

    // Tentar descobrir quem deletou via audit log
    try {
        const audit = await msg.guild!.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
        const entry = audit.entries.first();
        if (entry && entry.target?.id === author?.id && Date.now() - entry.createdTimestamp < 5_000) {
            if (entry.executor?.id !== author?.id) {
                idEntries['Moderador'] = entry.executor?.id ?? '?';
            }
        }
    } catch { /* sem permissão */ }

    idEntries['Mensagem'] = msg.id;

    const fields: { name: string; value: string }[] = [
        { name: 'Canal',    value: `<#${msg.channelId}>` },
        { name: 'Conteúdo', value: content },
    ];

    if (msg.attachments?.size) {
        const names = [...msg.attachments.values()].map(a => a.name).join(', ');
        fields.push({ name: `Anexos (${msg.attachments.size})`, value: truncate(names) });
    }

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setAuthor({
            name:    author?.tag ?? 'Desconhecido',
            iconURL: author?.displayAvatarURL({ size: 64 }) ?? undefined,
        })
        .setDescription(
            `Uma mensagem de ${author ? `**${author.tag}**` : 'alguém'} foi deletada em <#${msg.channelId}>`,
        )
        .addFields(...fields)
        .addFields({ name: '\u200B', value: idBlock(idEntries) })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Bulk Delete — purge (imagem 4) ──────────────────────────────────────────
// Gera um HTML no mesmo formato do exportchat e envia como attachment.
// Suporta 15k+ mensagens divididas em arquivos de 7,5 MB automaticamente.
EventCheckout.onMessageBulkDelete('logs:messageBulkDelete', async (
    msgs: Collection<Snowflake, Message | PartialMessage>,
) => {
    const firstMsg = msgs.first();
    if (!firstMsg?.guildId) return;

    const lm = await LogMinister.for(firstMsg.guild!);
    if (!lm || !lm.allows('messages')) return;

    const total   = msgs.size;
    const guild   = firstMsg.guild!;
    const channel = firstMsg.channel;

    // Separar mensagens completas (em cache) das parciais
    const fullMessages = [...msgs.values()]
        .filter((m): m is Message => !m.partial && !!m.author)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const cached   = fullMessages.length;
    const missing  = total - cached;

    // Tentar identificar quem executou o purge via audit log
    let executor = 'Desconhecido';
    try {
        const audit = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageBulkDelete });
        const entry = audit.entries.first();
        if (entry && Date.now() - entry.createdTimestamp < 8_000 && entry.executor) {
            executor = `${entry.executor.tag} (<@${entry.executor.id}>)`;
        }
    } catch { /* sem permissão */ }

    // ── Embed de notificação no canal de logs ──────────────────────────────
    const notifEmbed = new EmbedBuilder()
        .setColor(LogColor.bulkDelete)
        .setDescription(
            `🗑️ **${total}** mensagem(ns) foram deletadas em <#${firstMsg.channelId}>`,
        )
        .addFields(
            { name: 'Executado por',          value: executor,         inline: true },
            { name: 'Em cache (recuperadas)', value: String(cached),   inline: true },
            { name: 'Não recuperadas',        value: String(missing),  inline: true },
            { name: 'Canal',                  value: `<#${firstMsg.channelId}>` },
        )
        .setTimestamp();

    if (fullMessages.length === 0) {
        // Nenhuma mensagem em cache — só embed, sem arquivo
        notifEmbed.addFields({
            name:  'Aviso',
            value: '⚠️ Nenhuma mensagem estava em cache — conteúdo não recuperável.',
        });
        await lm.send(notifEmbed);
        return;
    }

    // ── Montar caches de cores e nomes para o HTML ─────────────────────────
    const colorCache = new Map<string, string>();
    const nameCache  = new Map<string, string>();

    for (const msg of fullMessages) {
        nameCache.set(msg.author.id, msg.author.tag);
        if (!colorCache.has(msg.author.id)) {
            // Usar a cor do cargo mais alto do membro, se disponível
            let color = '#ffffff';
            try {
                const member: GuildMember | undefined =
                    msg.member ?? await guild.members.fetch(msg.author.id).catch(() => undefined);
                if (member) {
                    const topColor = member.roles.color?.hexColor;
                    if (topColor && topColor !== '#000000') color = topColor;
                }
            } catch { /* sem acesso ao membro */ }
            colorCache.set(msg.author.id, color);
        }
    }

    // ── Montar título e banner do HTML ─────────────────────────────────────
    const channelName = (channel as any).name ?? firstMsg.channelId;
    const dateStr     = new Date().toLocaleDateString('pt-BR');
    const timeStr     = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const htmlTitle   = `purge-#${channelName}-${dateStr.replace(/\//g, '-')}`;
    const subtitle    = `${total} mensagens deletadas por ${executor} em ${dateStr} ${timeStr}`;
    const banner      = `⚠️ PURGE — ${total} mensagens deletadas por ${executor} em #${channelName} (${dateStr} ${timeStr})`;

    // ── Gerar attachments HTML ─────────────────────────────────────────────
    let attachments;
    try {
        attachments = buildAttachments(fullMessages, colorCache, nameCache, htmlTitle, subtitle, banner);
    } catch (e) {
        console.error('[logs:messageBulkDelete] Erro ao gerar HTML:', e);
        notifEmbed.addFields({ name: 'Erro', value: '❌ Falha ao gerar o arquivo de transcript.' });
        await lm.send(notifEmbed);
        return;
    }

    // ── Enviar embed de notificação + arquivos HTML ────────────────────────
    // Se for apenas 1 arquivo, envia junto com o embed.
    // Se forem múltiplos, envia o embed primeiro e os arquivos em seguida.
    if (attachments.length === 1) {
        await lm.sendWithFiles(notifEmbed, attachments);
    } else {
        await lm.send(notifEmbed);
        for (const att of attachments) {
            await lm.sendFile(att);
        }
    }
});
