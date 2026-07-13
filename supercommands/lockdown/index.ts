// RPTool/supercommands/lockdown/index.ts
// ─── Modo lockdown (rp!lockdown) ──────────────────────────────────────────────
//
// Tranca o servidor inteiro: todo mundo continua VENDO os chats, mas ninguém
// envia mensagem, reação, enquete, thread nem fala em call. A mecânica (deny no
// @everyone por canal + cargo bypass) está documentada em ./engine.ts.
//
//   rp!lockdown on              — tranca o servidor (staff)
//   rp!lockdown off             — restaura tudo como estava e apaga o cargo
//   rp!lockdown access @membro  — alterna liberação individual (dá/tira o cargo)
//   rp!lockdown free #canal     — alterna liberação de um canal pra todo mundo
//   rp!lockdown status          — situação atual
//
// Quem NÃO é afetado: administradores (ignoram overwrites), o próprio bot
// (recebe o cargo bypass ao ativar) e canais que já eram fechados/ocultos pro
// @everyone (anúncios, canais de staff) — esses nem são tocados.
// Canal criado durante o lockdown nasce trancado (hook de channelCreate).

import { GuildChannel, Message, PermissionFlagsBits } from 'discord.js';
import { EventCheckout } from '../../tools/eventCheckout';
import { LockdownConfigModel } from '../../tools/models/LockdownConfig';
import {
    BYPASS_ROLE_NAME,
    isAlreadyClosed,
    lockableChannels,
    lockChannel,
    restoreChannel,
    runPool,
    snapshotChannel,
} from './engine';

// ─── Cache do estado ativo (pro hook de channelCreate não bater no Mongo à toa) ─

const CACHE_TTL = 5 * 60_000;
const activeCache = new Map<string, { active: boolean; roleId: string; until: number }>();

// Guilds com on/off em andamento (ver guard no execute)
const busy = new Set<string>();

function invalidateLockdown(guildId: string): void {
    activeCache.delete(guildId);
}

async function getLockdownState(guildId: string): Promise<{ active: boolean; roleId: string }> {
    const hit = activeCache.get(guildId);
    if (hit && hit.until > Date.now()) return hit;
    const cfg = await LockdownConfigModel.findOne({ guildId }).lean();
    const state = { active: !!cfg?.active, roleId: cfg?.bypassRoleId ?? '', until: Date.now() + CACHE_TTL };
    activeCache.set(guildId, state);
    return state;
}

// ─── Canal criado durante o lockdown nasce trancado ───────────────────────────

EventCheckout.onChannelCreate('lockdown:newChannel', async (channel) => {
    if (!channel.guild) return;
    const state = await getLockdownState(channel.guild.id);
    if (!state.active) return;
    if (!('permissionOverwrites' in channel)) return;
    if (isAlreadyClosed(channel as GuildChannel)) return; // nasceu oculto/fechado (copiou de categoria de staff)

    const snap = snapshotChannel(channel as GuildChannel);
    const role = channel.guild.roles.cache.get(state.roleId) ?? null;
    try {
        await lockChannel(channel as GuildChannel, role);
        await LockdownConfigModel.updateOne(
            { guildId: channel.guild.id, active: true },
            { $push: { snapshots: snap } },
        );
    } catch (e) {
        console.error('[Lockdown] Falha ao trancar canal recém-criado:', e);
    }
});

// ─── Comando rp!lockdown ──────────────────────────────────────────────────────

export default {
    name: 'lockdown',
    description: 'Tranca o servidor: todos veem os chats, ninguém envia mensagem ou reação.',
    aliases: ['lock'],

    async execute(message: Message, args: string[]) {
        const guild = message.guild;
        if (!guild) return;
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ Apenas quem gerencia o servidor (staff) pode usar o lockdown.');
        }

        const guildId = guild.id;
        const action = args[0]?.toLowerCase();

        // Dois on/off simultâneos no mesmo servidor corromperiam o snapshot
        // (o segundo fotografaria o estado já trancado). Guard em memória basta:
        // o bot é um processo único.
        if ((action === 'on' || action === 'ativar' || action === 'off' || action === 'desativar') && busy.has(guildId)) {
            return message.reply('⏳ Já tem uma operação de lockdown em andamento neste servidor — aguarde ela terminar.');
        }
        let adquiriuBusy = false;

        try {
            const cfg = await LockdownConfigModel.findOne({ guildId });

            switch (action) {
                case 'on':
                case 'ativar': {
                    if (cfg?.active) {
                        return message.reply('🔒 O lockdown **já está ativo**. `rp!lockdown off` pra encerrar.');
                    }
                    busy.add(guildId);
                    adquiriuBusy = true;
                    const me = guild.members.me;
                    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
                        return message.reply('❌ Preciso da permissão `Gerenciar Cargos` pra criar o cargo bypass e editar as permissões dos canais.');
                    }

                    const alvo = lockableChannels(guild).filter(ch => !isAlreadyClosed(ch));
                    const progresso = await message.reply(`🔒 Ativando lockdown — trancando **${alvo.length}** canais...`);

                    let role;
                    try {
                        role = await guild.roles.create({
                            name: BYPASS_ROLE_NAME,
                            permissions: [],
                            reason: `Lockdown ativado por ${message.author.tag}`,
                        });
                    } catch (e) {
                        console.error('[Lockdown] Falha ao criar cargo bypass:', e);
                        return progresso.edit('❌ Não consegui criar o cargo bypass — verifique minha permissão `Gerenciar Cargos`.');
                    }
                    // O bot recebe o bypass pra não silenciar a si mesmo (e seus painéis)
                    await me.roles.add(role, 'Lockdown: o bot não se auto-silencia').catch(() => {});

                    // Snapshot ANTES de editar + config gravada ANTES do loop:
                    // se o bot cair no meio, rp!lockdown off restaura tudo.
                    const snapshots = alvo.map(snapshotChannel);
                    await LockdownConfigModel.findOneAndUpdate(
                        { guildId },
                        {
                            active: true, bypassRoleId: role.id, snapshots,
                            freedChannels: [], startedBy: message.author.id,
                        },
                        { upsert: true },
                    );
                    invalidateLockdown(guildId);

                    const { ok, failed } = await runPool(alvo, 4, ch => lockChannel(ch, role));

                    const falhas = failed ? `\n⚠️ **${failed}** canais falharam (sem acesso/permissão) — confira manualmente.` : '';
                    return progresso.edit(
                        `🔒 **Lockdown ativado!** ${ok} canais trancados — todo mundo vê, ninguém fala.${falhas}\n` +
                        `> Administradores não são afetados. Staff sem admin: \`rp!lockdown access @membro\`.\n` +
                        `> Liberar um canal pra conversa: \`rp!lockdown free #canal\`. Encerrar: \`rp!lockdown off\`.`,
                    );
                }

                case 'off':
                case 'desativar': {
                    if (!cfg?.active) {
                        return message.reply('🔓 O lockdown **não está ativo**.');
                    }
                    busy.add(guildId);
                    adquiriuBusy = true;
                    // Canais já liberados via `free` já estão restaurados — não re-restaura
                    const pendentes = [...cfg.snapshots].filter(s => !cfg.freedChannels.includes(s.channelId));
                    const progresso = await message.reply(`🔓 Encerrando lockdown — restaurando **${pendentes.length}** canais...`);

                    const { failed } = await runPool(pendentes, 4, async snap => {
                        const ch = guild.channels.cache.get(snap.channelId);
                        if (!ch || ch.isThread() || !('permissionOverwrites' in ch)) return; // canal apagado durante o lockdown
                        await restoreChannel(guild, ch as GuildChannel, snap);
                    });

                    // Apagar o cargo remove os overwrites de bypass de todos os canais de uma vez
                    const role = guild.roles.cache.get(cfg.bypassRoleId);
                    if (role) await role.delete('Lockdown encerrado').catch(() => {});

                    await LockdownConfigModel.updateOne(
                        { guildId },
                        { active: false, bypassRoleId: '', snapshots: [], freedChannels: [] },
                    );
                    invalidateLockdown(guildId);

                    const falhas = failed ? `\n⚠️ **${failed}** canais não puderam ser restaurados — confira manualmente.` : '';
                    return progresso.edit(`🔓 **Lockdown encerrado!** Permissões restauradas exatamente como estavam.${falhas}`);
                }

                case 'access':
                case 'acesso':
                case 'liberar': {
                    if (!cfg?.active) {
                        return message.reply('🔓 O lockdown não está ativo — não há o que liberar.');
                    }
                    const alvo = message.mentions.members?.first();
                    if (!alvo) return message.reply('Uso: `rp!lockdown access @membro` — alterna a liberação individual.');

                    const role = guild.roles.cache.get(cfg.bypassRoleId);
                    if (!role) {
                        return message.reply('❌ O cargo bypass sumiu (apagado manualmente?). Rode `rp!lockdown off` e `on` de novo.');
                    }

                    try {
                        if (alvo.roles.cache.has(role.id)) {
                            await alvo.roles.remove(role, `Lockdown: liberação removida por ${message.author.tag}`);
                            return message.reply(`🔒 ${alvo} **voltou pro lockdown** (cargo bypass removido).`);
                        }
                        await alvo.roles.add(role, `Lockdown: liberado por ${message.author.tag}`);
                        return message.reply(`🔓 ${alvo} **liberado!** Pode conversar normalmente enquanto o resto segue trancado.`);
                    } catch (e) {
                        console.error('[Lockdown] Falha ao alternar cargo bypass:', e);
                        return message.reply('❌ Não consegui mexer no cargo desse membro — meu cargo precisa estar acima do cargo bypass.');
                    }
                }

                case 'free':
                case 'abrir': {
                    if (!cfg?.active) {
                        return message.reply('🔓 O lockdown não está ativo — não há o que abrir.');
                    }
                    const mencao = message.mentions.channels.first();
                    if (!mencao) return message.reply('Uso: `rp!lockdown free #canal` — alterna a liberação do canal pra todo mundo.');

                    const ch = guild.channels.cache.get(mencao.id);
                    if (!ch || ch.isThread() || !('permissionOverwrites' in ch)) {
                        return message.reply('❌ Mencione um canal normal do servidor (pra thread, libere o canal-pai).');
                    }

                    const snap = cfg.snapshots.find(s => s.channelId === ch.id);
                    if (!snap) {
                        return message.reply('❌ Esse canal não foi trancado pelo lockdown — ele já era fechado/oculto pro @everyone antes.');
                    }

                    if (cfg.freedChannels.includes(ch.id)) {
                        await lockChannel(ch as GuildChannel, guild.roles.cache.get(cfg.bypassRoleId) ?? null);
                        await LockdownConfigModel.updateOne({ guildId }, { $pull: { freedChannels: ch.id } });
                        return message.reply(`🔒 ${ch} **voltou pro lockdown**.`);
                    }

                    await restoreChannel(guild, ch as GuildChannel, snap);
                    await LockdownConfigModel.updateOne({ guildId }, { $addToSet: { freedChannels: ch.id } });
                    return message.reply(`🔓 ${ch} **liberado pra todo mundo!** O resto do servidor continua trancado.`);
                }

                case 'status':
                case undefined: {
                    if (!cfg?.active) {
                        return message.reply('🔓 **Lockdown inativo.** `rp!lockdown on` tranca o servidor (todos veem, ninguém fala).');
                    }
                    const livres = cfg.freedChannels.length
                        ? cfg.freedChannels.map(id => `<#${id}>`).join(', ')
                        : '*nenhum*';
                    return message.reply(
                        `🔒 **Lockdown ATIVO** — iniciado por <@${cfg.startedBy}>\n\n` +
                        `**Canais trancados:** ${cfg.snapshots.length - cfg.freedChannels.length}\n` +
                        `**Canais liberados (\`free\`):** ${livres}\n` +
                        `**Liberação individual:** quem tem o cargo <@&${cfg.bypassRoleId}> (\`rp!lockdown access @membro\`)\n\n` +
                        `\`rp!lockdown off\` restaura tudo como estava.`,
                    );
                }

                default:
                    return sendHelp(message);
            }
        } catch (e) {
            console.error(`[Lockdown] Erro em "${action}":`, e);
            return message.reply('🚨 Erro interno no lockdown. Tente novamente.');
        } finally {
            if (adquiriuBusy) busy.delete(guildId);
        }
    },
};

// ─── Ajuda ────────────────────────────────────────────────────────────────────

function sendHelp(message: Message) {
    return message.reply(
        `🔒 **Modo Lockdown**\n\n` +
        `\`rp!lockdown on\` — tranca o servidor: todos **veem** os chats, ninguém envia mensagem, reação, enquete ou fala em call\n` +
        `\`rp!lockdown off\` — encerra e restaura as permissões **exatamente** como estavam\n` +
        `\`rp!lockdown access @membro\` — alterna liberação individual (dá/tira o cargo bypass)\n` +
        `\`rp!lockdown free #canal\` — alterna liberação de um canal pra todo mundo (o resto segue trancado)\n` +
        `\`rp!lockdown status\` — situação atual\n\n` +
        `Administradores não são afetados (permissão de admin ignora o tranca). Canais que já eram ` +
        `fechados ou ocultos pro @everyone (anúncios, staff) não são tocados. Canal criado durante ` +
        `o lockdown já nasce trancado. Requer que o bot tenha \`Gerenciar Cargos\`.`,
    );
}
