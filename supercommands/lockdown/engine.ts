// RPTool/supercommands/lockdown/engine.ts
// ─── Motor do lockdown: overwrites de canal + cargo bypass ────────────────────
//
// Estratégia O(canais), não O(membros): dar um cargo a cada membro seria uma
// chamada de API por pessoa (inviável em servidor grande, rate limit), e um
// cargo que só NEGA permissão perde para o allow de outro cargo no canal.
// Em vez disso, o lockdown nega SendMessages/AddReactions/... para o @everyone
// em cada canal (overwrite de canal vence permissão-base de qualquer cargo) e
// cria um cargo bypass com ALLOW nos mesmos canais (allow de cargo em overwrite
// vence o deny do @everyone). Liberar alguém = 1 chamada (dar o cargo).
//
// O estado anterior do @everyone em cada canal é fotografado no Mongo antes de
// trancar — rp!lockdown off devolve o servidor EXATAMENTE como estava (canais
// que já eram só-leitura, ex: anúncios, nem são tocados).

import {
    ChannelType, Guild, GuildChannel, NonThreadGuildBasedChannel,
    PermissionsBitField, PermissionFlagsBits, Role,
} from 'discord.js';
import { ILockdownSnapshot } from '../../tools/models/LockdownConfig';

export const BYPASS_ROLE_NAME = '🔓 Lockdown Bypass';

// Permissões negadas ao @everyone (e permitidas ao cargo bypass) em cada canal.
// Ver = liberado; falar/reagir/thread/enquete/voz = trancado.
export const LOCK_PERMS = [
    'SendMessages',
    'SendMessagesInThreads',
    'CreatePublicThreads',
    'CreatePrivateThreads',
    'AddReactions',
    'SendPolls',
    'Speak',
] as const;

type PermState = Partial<Record<(typeof LOCK_PERMS)[number], boolean | null>>;

function permStates(value: boolean | null): PermState {
    const out: PermState = {};
    for (const p of LOCK_PERMS) out[p] = value;
    return out;
}

// ─── Seleção de canais ────────────────────────────────────────────────────────
// Categorias ficam de fora de propósito: trancar uma categoria faria canal novo
// criado nela (que copia os overwrites da categoria) nascer com os denies do
// lockdown "de fábrica" — e o off não saberia restaurá-lo. Canal novo é coberto
// pelo hook de channelCreate (ver index.ts).

export function lockableChannels(guild: Guild): GuildChannel[] {
    return [...guild.channels.cache.values()]
        .filter((ch): ch is NonThreadGuildBasedChannel =>
            !ch.isThread() && ch.type !== ChannelType.GuildCategory && 'permissionOverwrites' in ch);
}

// Canais que o lockdown NÃO toca: onde o @everyone já não vê (canais de staff —
// trancar silenciaria a staff, que só tem allow de ViewChannel lá) ou já não
// fala (anúncios, vitrines). Também evita que o cargo bypass abra esses canais.
export function isAlreadyClosed(channel: GuildChannel): boolean {
    const ow = channel.permissionOverwrites.cache.get(channel.guild.id);
    if (!ow) return false;
    return ow.deny.has(PermissionFlagsBits.ViewChannel)
        || ow.deny.has(PermissionFlagsBits.SendMessages);
}

// ─── Snapshot / lock / restore de um canal ────────────────────────────────────

export function snapshotChannel(channel: GuildChannel): ILockdownSnapshot {
    const ow = channel.permissionOverwrites.cache.get(channel.guild.id);
    return {
        channelId:    channel.id,
        hadOverwrite: !!ow,
        allow:        ow ? ow.allow.bitfield.toString() : '0',
        deny:         ow ? ow.deny.bitfield.toString()  : '0',
    };
}

export async function lockChannel(channel: GuildChannel, bypassRole: Role | null): Promise<void> {
    // .edit() mescla com o overwrite existente — só os LOCK_PERMS mudam.
    await channel.permissionOverwrites.edit(
        channel.guild.roles.everyone, permStates(false), { reason: 'Lockdown ativado' },
    );
    if (bypassRole) {
        await channel.permissionOverwrites.edit(
            bypassRole, permStates(true), { reason: 'Lockdown: allow do cargo bypass' },
        );
    }
}

export async function restoreChannel(guild: Guild, channel: GuildChannel, snap: ILockdownSnapshot): Promise<void> {
    if (!snap.hadOverwrite) {
        // O overwrite do @everyone foi criado pelo lockdown → some por inteiro.
        await channel.permissionOverwrites.delete(guild.roles.everyone, 'Lockdown encerrado');
        return;
    }
    // Devolve só os LOCK_PERMS ao estado do snapshot (allow/deny/neutro);
    // os demais bits não foram tocados pelo lockdown.
    const allow = new PermissionsBitField(BigInt(snap.allow));
    const deny  = new PermissionsBitField(BigInt(snap.deny));
    const state: PermState = {};
    for (const p of LOCK_PERMS) {
        state[p] = allow.has(p) ? true : deny.has(p) ? false : null;
    }
    await channel.permissionOverwrites.edit(guild.roles.everyone, state, { reason: 'Lockdown encerrado' });
}

// O pool de concorrência (runPool) foi promovido para tools/utils/pool.ts.
// Cada canal tem seu próprio bucket de rate limit na API → 4 em paralelo é
// seguro (o discord.js enfileira sozinho se esbarrar no limite global).
