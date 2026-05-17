// RPTool/events/autoModerationEvents.ts
// ─── Intents ──────────────────────────────────────────────────────────────────
// AUTO_MODERATION_CONFIGURATION (1 << 20): criação/edição/deleção de regras
// AUTO_MODERATION_EXECUTION     (1 << 21): disparo de uma regra
import {
    Events,
    AutoModerationRule,
    AutoModerationActionExecution,
    Client,
} from 'discord.js';

export default [

    // ── AUTO_MODERATION_RULE_CREATE ───────────────────────────────────────────
    { name: Events.AutoModerationRuleCreate, once: false,
      execute: async (_rule: AutoModerationRule, _client: Client) => {
        // TODO: supercommands/logs/events/autoModerationLogs.ts → onRuleCreate
      }},

    // ── AUTO_MODERATION_RULE_UPDATE ───────────────────────────────────────────
    { name: Events.AutoModerationRuleUpdate, once: false,
      execute: async (_old: AutoModerationRule | null, _new: AutoModerationRule, _client: Client) => {
        // TODO: supercommands/logs/events/autoModerationLogs.ts → onRuleUpdate
      }},

    // ── AUTO_MODERATION_RULE_DELETE ───────────────────────────────────────────
    { name: Events.AutoModerationRuleDelete, once: false,
      execute: async (_rule: AutoModerationRule, _client: Client) => {
        // TODO: supercommands/logs/events/autoModerationLogs.ts → onRuleDelete
      }},

    // ── AUTO_MODERATION_ACTION_EXECUTION ──────────────────────────────────────
    // ⚠️ Pode ter volume alto em servidores com filtros ativos de palavras/spam
    { name: Events.AutoModerationActionExecution, once: false,
      execute: async (_execution: AutoModerationActionExecution, _client: Client) => {
        // TODO: supercommands/logs/events/autoModerationLogs.ts → onActionExecution
        // Loga: usuário afetado, regra disparada, ação tomada (block/warn/timeout)
      }},
];