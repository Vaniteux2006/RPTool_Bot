// RPTool/supercommands/logs/events/autoModerationLogs.ts
// Intents necessários: AUTO_MODERATION_CONFIGURATION (1<<20) + EXECUTION (1<<21)
// ⚠️ NÃO IMPLEMENTADO
import { AutoModerationRule, AutoModerationActionExecution, Client } from 'discord.js';

export async function onRuleCreate(_rule: AutoModerationRule, _client: Client) {
    // TODO: nome da regra, tipo de trigger (keyword/spam/mention_spam/etc),
    //       ações configuradas (block/warn/timeout), quem criou (audit log)
}

export async function onRuleUpdate(_old: AutoModerationRule | null, _new: AutoModerationRule, _client: Client) {
    // TODO: diff — o que mudou na regra (palavras, ações, canais isentos)
}

export async function onRuleDelete(_rule: AutoModerationRule, _client: Client) {
    // TODO: regra removida; nome e tipo — quem removeu (audit log)
}

export async function onActionExecution(_execution: AutoModerationActionExecution, _client: Client) {
    // TODO: quem disparou a regra, qual regra, ação tomada, conteúdo (se disponível)
    // ⚠️ Volume potencialmente alto em servidores com filtros de spam/palavras ativos
    //    Implementar com cooldown por usuário: máx 1 log por usuário a cada 30s por regra
}