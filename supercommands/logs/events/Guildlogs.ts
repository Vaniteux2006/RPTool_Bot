// RPTool/supercommands/logs/events/GuildLogs.ts
// ─── Log: Servidor, Canais, Cargos, Threads ───────────────────────────────────
// Intent: GUILDS (1 << 0)
// Referência visual: imagem 7 (guild update)

import {
    Guild, Role, NonThreadGuildBasedChannel, ThreadChannel,
    StageInstance, Collection, Snowflake, ThreadMember,
    AuditLogEvent, EmbedBuilder, ChannelType,
} from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, truncate, avatarOf } from '../utils/LogMinister';

// Ícone por tipo de canal
const channelTypeIcon: Partial<Record<ChannelType, string>> = {
    [ChannelType.GuildText]:          '💬',
    [ChannelType.GuildVoice]:         '🔊',
    [ChannelType.GuildCategory]:      '📂',
    [ChannelType.GuildAnnouncement]:  '📢',
    [ChannelType.GuildForum]:         '🗂️',
    [ChannelType.GuildStageVoice]:    '🎙️',
};

// ─── Guild Update (imagem 7) ──────────────────────────────────────────────────
EventCheckout.onGuildUpdate('logs:guildUpdate', async (oldGuild: Guild, newGuild: Guild) => {
    const lm = await LogMinister.for(newGuild);
    if (!lm || !lm.allows('channels')) return;

    const changes: { name: string; value: string }[] = [];

    if (oldGuild.name !== newGuild.name)
        changes.push({ name: 'Nome',          value: `\`${oldGuild.name}\` → \`${newGuild.name}\`` });
    if (oldGuild.verificationLevel !== newGuild.verificationLevel)
        changes.push({ name: 'Nível de verificação', value: `${verificationLabel(oldGuild.verificationLevel)} → ${verificationLabel(newGuild.verificationLevel)}` });
    if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter)
        changes.push({ name: 'Filtro de conteúdo', value: `${oldGuild.explicitContentFilter} → ${newGuild.explicitContentFilter}` });
    if (oldGuild.afkChannelId !== newGuild.afkChannelId)
        changes.push({ name: 'Canal AFK',     value: newGuild.afkChannelId ? `<#${newGuild.afkChannelId}>` : '*(removido)*' });
    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode)
        changes.push({ name: 'URL Personalizada', value: `\`${oldGuild.vanityURLCode ?? '(nenhuma)'}\` → \`${newGuild.vanityURLCode ?? '(removida)'}\`` });
    if (oldGuild.premiumTier !== newGuild.premiumTier)
        changes.push({ name: 'Nível de Boost', value: `Tier ${oldGuild.premiumTier} → Tier ${newGuild.premiumTier}` });

    if (!changes.length) return;

    // Tentar pegar quem alterou (audit log)
    let executor = '';
    try {
        const audit = await newGuild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildUpdate });
        const entry = audit.entries.first();
        if (entry && Date.now() - entry.createdTimestamp < 5_000 && entry.executor) {
            executor = ` — por <@${entry.executor.id}>`;
        }
    } catch { /* sem permissão */ }

    const embed = new EmbedBuilder()
        .setColor(LogColor.update)
        .setAuthor({ name: newGuild.name, iconURL: newGuild.iconURL({ size: 64 }) ?? undefined })
        .setDescription(`O servidor foi atualizado${executor}`)
        .addFields(...changes.map(c => ({ ...c, inline: false })))
        .setTimestamp();

    await lm.send(embed);
});

// ─── Channel Create ───────────────────────────────────────────────────────────
EventCheckout.onChannelCreate('logs:channelCreate', async (channel: NonThreadGuildBasedChannel) => {
    const lm = await LogMinister.for(channel.guild);
    if (!lm || !lm.allows('channels')) return;

    const icon    = channelTypeIcon[channel.type] ?? '#';
    let executor  = '';
    try {
        const audit = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
        const entry = audit.entries.first();
        if (entry && Date.now() - entry.createdTimestamp < 5_000 && entry.executor)
            executor = entry.executor.id;
    } catch { /* sem permissão */ }

    const embed = new EmbedBuilder()
        .setColor(LogColor.join)
        .setDescription(`${icon} Canal **${channel.name}** foi criado`)
        .addFields(
            { name: 'Nome',      value: `${channel}`, inline: true },
            { name: 'Tipo',      value: ChannelType[channel.type] ?? String(channel.type), inline: true },
            { name: 'Categoria', value: channel.parent?.name ?? '*(raiz)*', inline: true },
            ...(executor ? [{ name: 'Criado por', value: `<@${executor}>` }] : []),
        )
        .addFields({ name: '\u200B', value: idBlock({ Channel: channel.id, Guild: channel.guild.id }) })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Channel Delete ───────────────────────────────────────────────────────────
EventCheckout.onChannelDelete('logs:channelDelete', async (channel: any) => {
    if (!channel.guild) return;
    const lm = await LogMinister.for(channel.guild);
    if (!lm || !lm.allows('channels')) return;

    let executor = '';
    try {
        const audit = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
        const entry = audit.entries.first();
        if (entry && Date.now() - entry.createdTimestamp < 5_000 && entry.executor)
            executor = entry.executor.id;
    } catch { /* sem permissão */ }

    const icon = channelTypeIcon[channel.type as ChannelType] ?? '#';

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`${icon} Canal **#${channel.name}** foi deletado`)
        .addFields(
            { name: 'Nome',      value: `#${channel.name}`, inline: true },
            { name: 'Tipo',      value: ChannelType[channel.type] ?? String(channel.type), inline: true },
            ...(executor ? [{ name: 'Deletado por', value: `<@${executor}>` }] : []),
        )
        .addFields({ name: '\u200B', value: idBlock({ Channel: channel.id }) })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Channel Update ───────────────────────────────────────────────────────────
EventCheckout.onChannelUpdate('logs:channelUpdate', async (oldCh: any, newCh: any) => {
    if (!newCh.guild) return;
    const lm = await LogMinister.for(newCh.guild);
    if (!lm || !lm.allows('channels')) return;

    const changes: { name: string; value: string }[] = [];
    if (oldCh.name  !== newCh.name)  changes.push({ name: 'Nome',    value: `\`${oldCh.name}\` → \`${newCh.name}\`` });
    if (oldCh.topic !== newCh.topic) changes.push({ name: 'Tópico',  value: `\`${truncate(oldCh.topic ?? '(vazio)', 400)}\` → \`${truncate(newCh.topic ?? '(vazio)', 400)}\`` });
    if (oldCh.nsfw  !== newCh.nsfw)  changes.push({ name: 'NSFW',    value: newCh.nsfw ? '🔞 Ativado' : '✅ Desativado' });
    if (oldCh.rateLimitPerUser !== newCh.rateLimitPerUser)
        changes.push({ name: 'Slowmode', value: `${oldCh.rateLimitPerUser}s → ${newCh.rateLimitPerUser}s` });

    if (!changes.length) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.update)
        .setDescription(`Canal ${newCh} foi atualizado`)
        .addFields(...changes)
        .addFields({ name: '\u200B', value: idBlock({ Channel: newCh.id }) })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Role Create ──────────────────────────────────────────────────────────────
EventCheckout.onGuildRoleCreate('logs:roleCreate', async (role: Role) => {
    const lm = await LogMinister.for(role.guild);
    if (!lm || !lm.allows('roles')) return;

    let executor = '';
    try {
        const audit = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
        const entry = audit.entries.first();
        if (entry && Date.now() - entry.createdTimestamp < 5_000 && entry.executor)
            executor = entry.executor.id;
    } catch { /* sem permissão */ }

    const embed = new EmbedBuilder()
        .setColor(role.color || LogColor.join)
        .setDescription(`Cargo **${role.name}** foi criado`)
        .addFields(
            { name: 'Nome',         value: `${role}`, inline: true },
            { name: 'Cor',          value: role.hexColor, inline: true },
            { name: 'Hoist',        value: role.hoist ? 'Sim' : 'Não', inline: true },
            { name: 'Mencionável',  value: role.mentionable ? 'Sim' : 'Não', inline: true },
            ...(executor ? [{ name: 'Criado por', value: `<@${executor}>` }] : []),
        )
        .addFields({ name: '\u200B', value: idBlock({ Role: role.id, Guild: role.guild.id }) })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Role Delete ──────────────────────────────────────────────────────────────
EventCheckout.onGuildRoleDelete('logs:roleDelete', async (role: Role) => {
    const lm = await LogMinister.for(role.guild);
    if (!lm || !lm.allows('roles')) return;

    let executor = '';
    try {
        const audit = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
        const entry = audit.entries.first();
        if (entry && Date.now() - entry.createdTimestamp < 5_000 && entry.executor)
            executor = entry.executor.id;
    } catch { /* sem permissão */ }

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`Cargo **${role.name}** foi deletado`)
        .addFields(
            { name: 'Nome', value: role.name, inline: true },
            { name: 'Cor',  value: role.hexColor, inline: true },
            ...(executor ? [{ name: 'Deletado por', value: `<@${executor}>` }] : []),
        )
        .addFields({ name: '\u200B', value: idBlock({ Role: role.id }) })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Role Update ──────────────────────────────────────────────────────────────
EventCheckout.onGuildRoleUpdate('logs:roleUpdate', async (oldRole: Role, newRole: Role) => {
    const lm = await LogMinister.for(newRole.guild);
    if (!lm || !lm.allows('roles')) return;

    const changes: { name: string; value: string }[] = [];
    if (oldRole.name     !== newRole.name)     changes.push({ name: 'Nome', value: `\`${oldRole.name}\` → \`${newRole.name}\`` });
    if (oldRole.hexColor !== newRole.hexColor) changes.push({ name: 'Cor',  value: `\`${oldRole.hexColor}\` → \`${newRole.hexColor}\`` });
    if (oldRole.hoist    !== newRole.hoist)    changes.push({ name: 'Hoist', value: newRole.hoist ? 'Ativado' : 'Desativado' });
    if (oldRole.mentionable !== newRole.mentionable)
        changes.push({ name: 'Mencionável', value: newRole.mentionable ? 'Ativado' : 'Desativado' });

    if (!changes.length) return;

    const embed = new EmbedBuilder()
        .setColor(newRole.color || LogColor.update)
        .setDescription(`Cargo ${newRole} foi atualizado`)
        .addFields(...changes)
        .addFields({ name: '\u200B', value: idBlock({ Role: newRole.id }) })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Threads ──────────────────────────────────────────────────────────────────
EventCheckout.onThreadCreate('logs:threadCreate', async (thread: ThreadChannel, newlyCreated: boolean) => {
    if (!newlyCreated) return; // ignorar thread_list_sync
    const lm = await LogMinister.for(thread.guild);
    if (!lm || !lm.allows('channels')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.join)
        .setDescription(`🧵 Thread **${thread.name}** foi criada em ${thread.parent ? `<#${thread.parentId}>` : '*canal desconhecido*'}`)
        .addFields({ name: '\u200B', value: idBlock({ Thread: thread.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onThreadDelete('logs:threadDelete', async (thread: ThreadChannel) => {
    const lm = await LogMinister.for(thread.guild);
    if (!lm || !lm.allows('channels')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`🧵 Thread **${thread.name}** foi deletada`)
        .addFields({ name: '\u200B', value: idBlock({ Thread: thread.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onThreadUpdate('logs:threadUpdate', async (old: ThreadChannel | null, newThread: ThreadChannel) => {
    const lm = await LogMinister.for(newThread.guild);
    if (!lm || !lm.allows('channels')) return;

    const changes: { name: string; value: string }[] = [];
    if (old?.name    !== newThread.name)    changes.push({ name: 'Nome', value: `\`${old?.name ?? '?'}\` → \`${newThread.name}\`` });
    if (old?.archived !== newThread.archived) changes.push({ name: 'Arquivada', value: newThread.archived ? 'Sim' : 'Não' });
    if (old?.locked  !== newThread.locked)  changes.push({ name: 'Travada',   value: newThread.locked   ? 'Sim' : 'Não' });

    if (!changes.length) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.update)
        .setDescription(`🧵 Thread **${newThread.name}** foi atualizada`)
        .addFields(...changes)
        .addFields({ name: '\u200B', value: idBlock({ Thread: newThread.id }) })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Stage ────────────────────────────────────────────────────────────────────
EventCheckout.onStageInstanceCreate('logs:stageCreate', async (stage: StageInstance) => {
    const lm = await LogMinister.for(stage.guild!);
    if (!lm || !lm.allows('channels')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.join)
        .setDescription(`🎙️ Stage **${stage.topic}** iniciada em <#${stage.channelId}>`)
        .setTimestamp();
    await lm.send(embed);
});

EventCheckout.onStageInstanceDelete('logs:stageDelete', async (stage: StageInstance) => {
    const lm = await LogMinister.for(stage.guild!);
    if (!lm || !lm.allows('channels')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`🎙️ Stage **${stage.topic}** encerrada`)
        .setTimestamp();
    await lm.send(embed);
});

EventCheckout.onThreadMembersUpdate('logs:threadMembersUpdate', async (
    added: Collection<Snowflake, ThreadMember>,
    removed: Collection<Snowflake, ThreadMember>,
    thread: ThreadChannel,
) => {
    // Só logar se for thread privada (público não tem relevância de auditoria)
    if (!thread.isThread() || !thread.guild) return;
    const lm = await LogMinister.for(thread.guild);
    if (!lm || !lm.allows('channels')) return;

    if (!added.size && !removed.size) return;

    const lines: string[] = [
        ...added.values()   && [...added.values()].map(m   => `➕ <@${m.id}>`),
        ...removed.values() && [...removed.values()].map(m => `➖ <@${m.id}>`),
    ];

    const embed = new EmbedBuilder()
        .setColor(LogColor.update)
        .setDescription(`🧵 Membros da thread **${thread.name}** foram atualizados`)
        .addFields({ name: 'Mudanças', value: truncate(lines.join('\n')) })
        .setTimestamp();
    await lm.send(embed);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function verificationLabel(level: number): string {
    const labels: Record<number, string> = {
        0: 'Nenhum',
        1: 'Baixo — e-mail verificado',
        2: 'Médio — conta com 5 min',
        3: 'Alto — membro por 10 min',
        4: 'Altíssimo — celular verificado',
    };
    return labels[level] ?? `Nível ${level}`;
}
