// RPTool/supercommands/logs/events/Expressionlogs.ts
// ─── Log: Emojis e Stickers ───────────────────────────────────────────────────
// Intent: GUILD_EXPRESSIONS (1 << 3)

import { GuildEmoji, Sticker, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock } from '../utils/LogMinister';

async function getExecutor(guild: any, type: AuditLogEvent): Promise<string | null> {
    try {
        const audit = await guild.fetchAuditLogs({ limit: 1, type });
        const entry = audit.entries.first();
        if (entry && Date.now() - entry.createdTimestamp < 5_000 && entry.executor)
            return entry.executor.id;
    } catch { /* sem permissão */ }
    return null;
}

// ── Emojis ────────────────────────────────────────────────────────────────────
EventCheckout.onGuildEmojiCreate('logs:emojiCreate', async (emoji: GuildEmoji) => {
    const lm = await LogMinister.for(emoji.guild);
    if (!lm || !lm.allows('expressions')) return;

    const executor = await getExecutor(emoji.guild, AuditLogEvent.EmojiCreate);
    const embed = new EmbedBuilder()
        .setColor(LogColor.join)
        .setDescription(`Emoji <${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}> **:${emoji.name}:** criado`)
        .setThumbnail(emoji.imageURL({ size: 128 }))
        .addFields(
            { name: 'Nome',     value: `:${emoji.name}:`, inline: true },
            { name: 'Animado', value: emoji.animated ? 'Sim' : 'Não', inline: true },
            ...(executor ? [{ name: 'Criado por', value: `<@${executor}>` }] : []),
        )
        .addFields({ name: '\u200B', value: idBlock({ Emoji: emoji.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onGuildEmojiDelete('logs:emojiDelete', async (emoji: GuildEmoji) => {
    const lm = await LogMinister.for(emoji.guild);
    if (!lm || !lm.allows('expressions')) return;

    const executor = await getExecutor(emoji.guild, AuditLogEvent.EmojiDelete);
    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`Emoji **:${emoji.name}:** deletado`)
        .setThumbnail(emoji.imageURL({ size: 128 }))
        .addFields(
            ...(executor ? [{ name: 'Deletado por', value: `<@${executor}>` }] : []),
        )
        .addFields({ name: '\u200B', value: idBlock({ Emoji: emoji.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onGuildEmojiUpdate('logs:emojiUpdate', async (old: GuildEmoji, newEmoji: GuildEmoji) => {
    if (old.name === newEmoji.name) return;
    const lm = await LogMinister.for(newEmoji.guild);
    if (!lm || !lm.allows('expressions')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.update)
        .setDescription(`Emoji <:${newEmoji.name}:${newEmoji.id}> renomeado`)
        .setThumbnail(newEmoji.imageURL({ size: 128 }))
        .addFields(
            { name: 'Nome novo',    value: `:${newEmoji.name}:`, inline: true },
            { name: 'Nome antigo',  value: `:${old.name}:`,      inline: true },
        )
        .addFields({ name: '\u200B', value: idBlock({ Emoji: newEmoji.id }) })
        .setTimestamp();

    await lm.send(embed);
});

// ── Stickers ──────────────────────────────────────────────────────────────────
EventCheckout.onGuildStickerCreate('logs:stickerCreate', async (sticker: Sticker) => {
    if (!sticker.guild) return;
    const lm = await LogMinister.for(sticker.guild);
    if (!lm || !lm.allows('expressions')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.join)
        .setDescription(`🎫 Sticker **${sticker.name}** criado`)
        .addFields({ name: 'Descrição', value: sticker.description ?? '*(sem descrição)*' })
        .addFields({ name: '\u200B',    value: idBlock({ Sticker: sticker.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onGuildStickerDelete('logs:stickerDelete', async (sticker: Sticker) => {
    if (!sticker.guild) return;
    const lm = await LogMinister.for(sticker.guild);
    if (!lm || !lm.allows('expressions')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`🎫 Sticker **${sticker.name}** deletado`)
        .addFields({ name: '\u200B', value: idBlock({ Sticker: sticker.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onGuildStickerUpdate('logs:stickerUpdate', async (old: Sticker, newSticker: Sticker) => {
    if (!newSticker.guild) return;
    if (old.name === newSticker.name && old.description === newSticker.description) return;
    const lm = await LogMinister.for(newSticker.guild);
    if (!lm || !lm.allows('expressions')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.update)
        .setDescription(`🎫 Sticker **${newSticker.name}** atualizado`)
        .addFields(
            ...(old.name !== newSticker.name ? [
                { name: 'Nome novo',   value: newSticker.name, inline: true },
                { name: 'Nome antigo', value: old.name,        inline: true },
            ] : []),
        )
        .addFields({ name: '\u200B', value: idBlock({ Sticker: newSticker.id }) })
        .setTimestamp();

    await lm.send(embed);
});

// ── Soundboard ────────────────────────────────────────────────────────────────
// O objeto `sound` (discord.js v14) expõe:
//   sound.soundId   — ID do som
//   sound.name      — nome do som
//   sound.volume    — volume padrão (0.0 a 1.0)
//   sound.emoji     — emoji associado | null
//   sound.guildId   — servidor
//   sound.available — se está disponível

EventCheckout.onSoundboardSoundCreate('logs:soundCreate', async (sound: any) => {
    if (!sound.guildId) return;
    const guild = sound.guild ?? null;
    if (!guild) return;

    const lm = await LogMinister.for(guild);
    if (!lm || !lm.allows('expressions')) return;

    const emojiDisplay = sound.emoji
        ? (sound.emoji.id
            ? `<:${sound.emoji.name}:${sound.emoji.id}>`
            : sound.emoji.name)
        : '🔊';

    const embed = new EmbedBuilder()
        .setColor(LogColor.join)
        .setDescription(`${emojiDisplay} Som **${sound.name}** adicionado ao Soundboard`)
        .addFields(
            { name: 'Volume padrão', value: `${Math.round((sound.volume ?? 1) * 100)}%`, inline: true },
            { name: 'Emoji',         value: emojiDisplay, inline: true },
        )
        .addFields({ name: '\u200B', value: idBlock({ Sound: sound.soundId, Guild: sound.guildId }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onSoundboardSoundDelete('logs:soundDelete', async (sound: any) => {
    if (!sound.guildId) return;
    const guild = sound.guild ?? null;
    if (!guild) return;

    const lm = await LogMinister.for(guild);
    if (!lm || !lm.allows('expressions')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`🗑️ Som **${sound.name}** removido do Soundboard`)
        .addFields({ name: '\u200B', value: idBlock({ Sound: sound.soundId }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onSoundboardSoundUpdate('logs:soundUpdate', async (old: any, newSound: any) => {
    if (!newSound.guildId) return;
    const guild = newSound.guild ?? null;
    if (!guild) return;

    const lm = await LogMinister.for(guild);
    if (!lm || !lm.allows('expressions')) return;

    const changes: { name: string; value: string }[] = [];

    if (old?.name !== newSound.name)
        changes.push({ name: 'Nome',   value: `\`${old?.name ?? '?'}\` → \`${newSound.name}\`` });
    if (Math.round((old?.volume ?? 1) * 100) !== Math.round((newSound.volume ?? 1) * 100))
        changes.push({ name: 'Volume', value: `${Math.round((old?.volume ?? 1) * 100)}% → ${Math.round((newSound.volume ?? 1) * 100)}%` });

    if (!changes.length) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.update)
        .setDescription(`🔊 Som **${newSound.name}** do Soundboard atualizado`)
        .addFields(...changes)
        .addFields({ name: '\u200B', value: idBlock({ Sound: newSound.soundId }) })
        .setTimestamp();

    await lm.send(embed);
});
