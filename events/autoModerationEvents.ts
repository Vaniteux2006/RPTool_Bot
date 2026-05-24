// RPTool/events/autoModerationEvents.ts
// ─── Intents: AUTO_MODERATION_CONFIGURATION (1<<20) + EXECUTION (1<<21) ───────
// Eventos: AUTO_MODERATION_RULE_CREATE/UPDATE/DELETE
//          AUTO_MODERATION_ACTION_EXECUTION
//
// ⚠️ ACTION_EXECUTION: pode ter volume alto em servidores com filtros ativos.
//    Implementar com filtro de triggerType antes de qualquer I/O.
// Subscribers de log: supercommands/logs/events/Automoderationlogs.ts

import { EventCheckout } from '../tools/event_checkout';
import { AutoModerationRule, AutoModerationActionExecution } from 'discord.js';

EventCheckout.onAutoModerationRuleCreate('autoModEvents:central', async (_rule: AutoModerationRule) => {});
EventCheckout.onAutoModerationRuleUpdate('autoModEvents:central', async (_old: AutoModerationRule | null, _new: AutoModerationRule) => {});
EventCheckout.onAutoModerationRuleDelete('autoModEvents:central', async (_rule: AutoModerationRule) => {});
EventCheckout.onAutoModerationActionExecution('autoModEvents:central', async (_execution: AutoModerationActionExecution) => {
    // ⚠️ Filtrar por _execution.ruleTriggerType antes de processar
});
