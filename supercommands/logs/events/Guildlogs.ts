// RPTool/supercommands/logs/events/guildLogs.ts
// ─── Log: Servidor, Canais, Cargos, Threads, Stage ───────────────────────────
// Intents necessários: GUILDS (1 << 0)
// Todos os handlers aqui são chamados pelos arquivos em /events/ quando a
// funcionalidade de logs estiver ativada via rp!logs on neste servidor.
// ⚠️ NÃO IMPLEMENTADO — aguardando otimização de rate limit e cache
import { Guild, Role, NonThreadGuildBasedChannel, ThreadChannel, StageInstance, Client } from 'discord.js';
import { LogMinister } from '../../../tools/utils/LogMinister';

// ── Servidor ──────────────────────────────────────────────────────────────────

export async function onGuildUpdate(_old: Guild, _new: Guild, _client: Client) {
    // TODO: diff de nome, ícone, splash, vanity URL, nível de verificação,
    //       filtro de conteúdo explícito, boost tier, AFK channel, etc.
}

// ── Canais ────────────────────────────────────────────────────────────────────

export async function onChannelCreate(_channel: NonThreadGuildBasedChannel, _client: Client) {
    // TODO: embed com nome, tipo, categoria, quem criou (audit log)
}

export async function onChannelUpdate(_old: any, _new: any, _client: Client) {
    // TODO: diff de nome, tópico, permissões, slowmode, nsfw, posição
}

export async function onChannelDelete(_channel: any, _client: Client) {
    // TODO: embed com nome do canal deletado, quem deletou (audit log)
}

export async function onPinsUpdate(_channel: any, _client: Client) {
    // TODO: mensagem fixada/desafixada — buscar via channel.messages.fetchPinned()
}

// ── Cargos ────────────────────────────────────────────────────────────────────

export async function onRoleCreate(_role: Role, _client: Client) {
    // TODO: embed com nome, cor, permissões, hoist, mentionable
}

export async function onRoleUpdate(_old: Role, _new: Role, _client: Client) {
    // TODO: diff — o que mudou (nome, cor, perms, posição)
}

export async function onRoleDelete(_role: Role, _client: Client) {
    // TODO: embed com nome do cargo deletado e quem deletou (audit log)
}

// ── Threads ───────────────────────────────────────────────────────────────────

export async function onThreadCreate(_thread: ThreadChannel, _client: Client) {
    // TODO: nome, canal pai, quem criou, tipo (public/private/announcement)
}

export async function onThreadUpdate(_old: ThreadChannel | null, _new: ThreadChannel, _client: Client) {
    // TODO: diff — arquivado, travado, nome alterado, slowmode
}

export async function onThreadDelete(_thread: ThreadChannel, _client: Client) {
    // TODO: nome e canal pai do thread deletado
}

// ── Stage ─────────────────────────────────────────────────────────────────────

export async function onStageCreate(_stage: StageInstance, _client: Client) {
    // TODO: tópico da stage, canal, quem criou
}

export async function onStageUpdate(_old: StageInstance | null, _new: StageInstance, _client: Client) {
    // TODO: tópico alterado
}

export async function onStageDelete(_stage: StageInstance, _client: Client) {
    // TODO: stage encerrada
}