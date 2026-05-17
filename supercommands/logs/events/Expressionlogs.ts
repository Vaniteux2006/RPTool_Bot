// RPTool/supercommands/logs/events/expressionLogs.ts
// ─── Log: Emojis, Stickers, Soundboard ───────────────────────────────────────
// Intent necessário: GUILD_EXPRESSIONS (1 << 3)
// ⚠️ NÃO IMPLEMENTADO
import { GuildEmoji, Sticker, Client } from 'discord.js';

export async function onEmojiCreate(_emoji: GuildEmoji, _client: Client) {
    // TODO: nome, imagem, quem adicionou (audit log)
}
export async function onEmojiUpdate(_old: GuildEmoji, _new: GuildEmoji, _client: Client) {
    // TODO: nome renomeado, available alterado
}
export async function onEmojiDelete(_emoji: GuildEmoji, _client: Client) {
    // TODO: qual emoji foi removido e por quem (audit log)
}
export async function onStickerCreate(_sticker: Sticker, _client: Client) {
    // TODO: nome, descrição, tags, quem adicionou
}
export async function onStickerDelete(_sticker: Sticker, _client: Client) {
    // TODO: qual sticker foi removido
}
export async function onSoundCreate(_sound: any, _client: Client) {
    // TODO: nome, quem adicionou (aguardar suporte completo no discord.js)
}
export async function onSoundDelete(_sound: any, _client: Client) {
    // TODO: nome do som removido
}