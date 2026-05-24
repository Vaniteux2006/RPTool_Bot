// RPTool/events/integrationEvents.ts
// ─── Intents: GUILD_INTEGRATIONS (1 << 4) + GUILD_WEBHOOKS (1 << 5) ──────────
// Eventos: GUILD_INTEGRATIONS_UPDATE · INTEGRATION_CREATE/UPDATE/DELETE
//          WEBHOOKS_UPDATE
//
// ⚠️ FIX: IntegrationCreate/Update/Delete NÃO existem no enum Events do
//    discord.js v14. Registrar com string literals — já mapeados no EventCheckout.
//
// Subscribers de log: supercommands/logs/events/Integrationlogs.ts

import { EventCheckout } from '../tools/event_checkout';
import { Guild, Integration } from 'discord.js';

EventCheckout.onGuildIntegrationsUpdate('integrationEvents:central', async (_guild: Guild) => {});
EventCheckout.onIntegrationCreate('integrationEvents:central', async (_integration: Integration) => {});
EventCheckout.onIntegrationUpdate('integrationEvents:central', async (_integration: Integration) => {});
EventCheckout.onIntegrationDelete('integrationEvents:central', async (_integration: Integration) => {});
EventCheckout.onWebhooksUpdate('integrationEvents:central', async (_channel: any) => {});
