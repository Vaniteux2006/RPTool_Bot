// RPTool/events/integrationEvents.ts
// ─── Intents ──────────────────────────────────────────────────────────────────
// GUILD_INTEGRATIONS (1 << 4): GUILD_INTEGRATIONS_UPDATE · INTEGRATION_CREATE/UPDATE/DELETE
// GUILD_WEBHOOKS     (1 << 5): WEBHOOKS_UPDATE
//
// ⚠️ NOTA: IntegrationCreate, IntegrationUpdate e IntegrationDelete NÃO existem
//    no enum Events do discord.js v14 — registram com string literal mesmo.
import {
    Events,
    Guild,
    Integration,
    Client,
} from 'discord.js';

export default [

    // ── GUILD_INTEGRATIONS_UPDATE ─────────────────────────────────────────────
    { name: Events.GuildIntegrationsUpdate, once: false,
      execute: async (_guild: Guild, _client: Client) => {
        // TODO: supercommands/logs/events/integrationLogs.ts → onIntegrationsUpdate
      }},

    // ── INTEGRATION_CREATE ────────────────────────────────────────────────────
    // Usa string literal — não existe em Events.*
    { name: 'integrationCreate', once: false,
      execute: async (_integration: Integration, _client: Client) => {
        // TODO: supercommands/logs/events/integrationLogs.ts → onIntegrationCreate
      }},

    // ── INTEGRATION_UPDATE ────────────────────────────────────────────────────
    { name: 'integrationUpdate', once: false,
      execute: async (_integration: Integration, _client: Client) => {
        // TODO: supercommands/logs/events/integrationLogs.ts → onIntegrationUpdate
      }},

    // ── INTEGRATION_DELETE ────────────────────────────────────────────────────
    { name: 'integrationDelete', once: false,
      execute: async (_integration: Integration, _client: Client) => {
        // TODO: supercommands/logs/events/integrationLogs.ts → onIntegrationDelete
      }},

    // ── WEBHOOKS_UPDATE ───────────────────────────────────────────────────────
    { name: Events.WebhooksUpdate, once: false,
      execute: async (_channel: any, _client: Client) => {
        // TODO: supercommands/logs/events/integrationLogs.ts → onWebhooksUpdate
      }},
];