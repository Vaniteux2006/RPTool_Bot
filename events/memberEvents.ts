// RPTool/events/memberEvents.ts
// ─── Intent: GUILD_MEMBERS (1 << 1) — Privileged ────────────────────────────
// Cobre: GUILD_MEMBER_ADD · GUILD_MEMBER_UPDATE · GUILD_MEMBER_REMOVE
// Requer ativação manual no Discord Developer Portal
import {
    Events,
    GuildMember,
    PartialGuildMember,
    Client,
    EmbedBuilder,
    AuditLogEvent,
} from 'discord.js';
import { WelcomeModel } from '../tools/models/Outros';
import { getAverageColor } from 'fast-average-color-node';
import autoroleCommand from '../commands/autorole';

export default [

    // ── GUILD_MEMBER_ADD ──────────────────────────────────────────────────────
    {
        name:  Events.GuildMemberAdd,
        once:  false,
        execute: async (member: GuildMember, client: Client) => {

            // 1. Autorole — dá cargos automáticos configurados pelo ADM
            try { await autoroleCommand.giveRole(member); }
            catch (e) { console.error('❌ [memberEvents] Autorole falhou:', e); }

            // 2. Mensagem de boas-vindas
            try {
                const config = await WelcomeModel.findOne({ guildId: member.guild.id });
                if (config?.channelId) {
                    const channel = member.guild.channels.cache.get(config.channelId);
                    if (channel?.isTextBased()) {
                        const msg = config.joinMsg
                            .replace(/{user}/g,   `<@${member.id}>`)
                            .replace(/{server}/g, member.guild.name)
                            .replace(/{count}/g,  String(member.guild.memberCount));

                        let color = 0x5865F2;
                        try {
                            const avg = await getAverageColor(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
                            color = parseInt(avg.hex.replace('#', ''), 16);
                        } catch (_) {}

                        const embed = new EmbedBuilder()
                            .setColor(color)
                            .setDescription(msg)
                            .setThumbnail(member.user.displayAvatarURL());

                        await (channel as any).send({ embeds: [embed] });
                    }
                }
            } catch (e) { console.error('❌ [memberEvents] Welcome falhou:', e); }

            // ── LOG PLACEHOLDER ───────────────────────────────────────────────
            // TODO: chamar supercommands/logs/events/memberLogs.ts → onMemberAdd
        },
    },

    // ── GUILD_MEMBER_REMOVE ───────────────────────────────────────────────────
    {
        name:  Events.GuildMemberRemove,
        once:  false,
        execute: async (member: GuildMember | PartialGuildMember, client: Client) => {

            // Mensagem de saída (ban/kick/leave)
            try {
                const config = await WelcomeModel.findOne({ guildId: member.guild.id });
                if (config?.channelId) {
                    const channel = member.guild.channels.cache.get(config.channelId);
                    if (channel?.isTextBased()) {
                        const banLogs  = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd  }).catch(() => null);
                        const kickLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick    }).catch(() => null);
                        const banEntry  = banLogs?.entries.first();
                        const kickEntry = kickLogs?.entries.first();

                        const isBan  = !!(banEntry  && banEntry.target?.id  === member.id && Date.now() - banEntry.createdTimestamp  < 5000);
                        const isKick = !isBan && !!(kickEntry && kickEntry.target?.id === member.id && Date.now() - kickEntry.createdTimestamp < 5000);

                        let rawMsg = config.leaveMsg;
                        let color  = 0x1A2B4C;
                        if (isBan)       { rawMsg = config.banMsg;  color = 0xFF0000; }
                        else if (isKick) { rawMsg = config.kickMsg; color = 0xFFFFFF; }

                        const msg = rawMsg
                            .replace(/{user}/g,   `**${member.user?.username ?? 'Usuário'}**`)
                            .replace(/{server}/g, member.guild.name)
                            .replace(/{count}/g,  String(member.guild.memberCount));

                        const embed = new EmbedBuilder()
                            .setColor(color)
                            .setDescription(msg)
                            .setThumbnail(member.user?.displayAvatarURL() ?? null);

                        await (channel as any).send({ embeds: [embed] });
                    }
                }
            } catch (e) { console.error('❌ [memberEvents] Leave message falhou:', e); }

            // ── LOG PLACEHOLDER ───────────────────────────────────────────────
            // TODO: chamar supercommands/logs/events/memberLogs.ts → onMemberRemove
        },
    },

    // ── GUILD_MEMBER_UPDATE ───────────────────────────────────────────────────
    {
        name:  Events.GuildMemberUpdate,
        once:  false,
        execute: async (_old: GuildMember | PartialGuildMember, _new: GuildMember, _client: Client) => {
            // ── LOG PLACEHOLDER ───────────────────────────────────────────────
            // TODO: chamar supercommands/logs/events/memberLogs.ts → onMemberUpdate
            // Exemplo: nickname mudado, cargo adicionado/removido
        },
    },
];