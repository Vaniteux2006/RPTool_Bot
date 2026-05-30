// RPTool/supercommands/logs/events/Integrationlogs.ts
// ─── Log: Integrações e Webhooks ──────────────────────────────────────────────
// Intents: GUILD_INTEGRATIONS (1<<4) + GUILD_WEBHOOKS (1<<5)
//
// FIX ts(2339): entry.target no audit log de webhook é tipado como uma union.
// O target de WebhookCreate/Update/Delete é sempre um Webhook — mas discord.js
// não exporta um tipo Webhook específico para isso. Usamos a interface mínima
// { id: string; name?: string } em vez de (as any) para manter type safety.

import { Guild, Integration, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock } from '../utils/LogMinister';

// Interface mínima para o target de audit logs de webhook
interface WebhookTarget { id: string; name?: string; }

EventCheckout.onIntegrationCreate('logs:integrationCreate', async (integration: Integration) => {
    if (!integration.guild) return;
    const lm = await LogMinister.for(integration.guild);
    if (!lm || !lm.allows('integrations')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.integration)
        .setDescription(`🤖 Integração **${integration.name}** adicionada`)
        .addFields(
            { name: 'Tipo',       value: integration.type, inline: true },
            { name: 'Habilitada', value: integration.enabled ? 'Sim' : 'Não', inline: true },
            ...(integration.user ? [{ name: 'Adicionado por', value: `<@${integration.user.id}>` }] : []),
        )
        .addFields({ name: '\u200B', value: idBlock({ Integration: integration.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onIntegrationDelete('logs:integrationDelete', async (integration: Integration) => {
    if (!integration.guild) return;
    const lm = await LogMinister.for(integration.guild);
    if (!lm || !lm.allows('integrations')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`🤖 Integração **${integration.name}** removida`)
        .addFields({ name: '\u200B', value: idBlock({ Integration: integration.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onWebhooksUpdate('logs:webhooksUpdate', async (channel: any) => {
    if (!channel.guild) return;
    const lm = await LogMinister.for(channel.guild);
    if (!lm || !lm.allows('integrations')) return;

    let detail = 'Webhook criado, editado ou deletado.';
    try {
        const guild      = channel.guild;
        const auditTypes = [
            AuditLogEvent.WebhookCreate,
            AuditLogEvent.WebhookUpdate,
            AuditLogEvent.WebhookDelete,
        ] as const;

        for (const type of auditTypes) {
            const audit = await guild.fetchAuditLogs({ limit: 1, type });
            const entry = audit.entries.first();
            if (entry && Date.now() - entry.createdTimestamp < 5_000) {
                const action = type === AuditLogEvent.WebhookCreate ? 'criado'
                    : type === AuditLogEvent.WebhookUpdate ? 'editado' : 'deletado';

                // FIX: cast tipado em vez de (as any)
                const target = entry.target as WebhookTarget | null;
                const name   = target?.name ?? '?';

                detail = `Webhook **${name}** ${action} por <@${entry.executor?.id ?? '?'}>`;
                break;
            }
        }
    } catch { /* sem permissão */ }

    const embed = new EmbedBuilder()
        .setColor(LogColor.integration)
        .setDescription(`🔗 Webhook atualizado em <#${channel.id}>`)
        .addFields({ name: 'Detalhes', value: detail })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onGuildIntegrationsUpdate('logs:integrationsUpdate', async (_guild: Guild) => {
    // Evento genérico — handlers acima cobrem os detalhes. Sem duplicata.
});

EventCheckout.onIntegrationUpdate('logs:integrationUpdate', async (_integration: Integration) => {
    // Mudanças menores raramente têm relevância de auditoria.
});
