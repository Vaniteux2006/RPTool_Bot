// RPTool/supercommands/logs/events/Automoderationlogs.ts
// ─── Log: AutoMod ─────────────────────────────────────────────────────────────
// Intents: AUTO_MODERATION_CONFIGURATION (1<<20) + EXECUTION (1<<21)

import {
    AutoModerationRule, AutoModerationActionExecution,
    AutoModerationRuleTriggerType, AutoModerationActionType,
    EmbedBuilder,
} from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, truncate } from '../utils/LogMinister';

const triggerLabel: Record<AutoModerationRuleTriggerType, string> = {
    [AutoModerationRuleTriggerType.Keyword]:            'Palavra-chave',
    [AutoModerationRuleTriggerType.Spam]:               'Spam',
    [AutoModerationRuleTriggerType.KeywordPreset]:      'Lista predefinida',
    [AutoModerationRuleTriggerType.MentionSpam]:        'Spam de menções',
    [AutoModerationRuleTriggerType.MemberProfile]:      'Perfil de membro',
};

const actionLabel: Record<AutoModerationActionType, string> = {
    [AutoModerationActionType.BlockMessage]:         '🚫 Mensagem bloqueada',
    [AutoModerationActionType.SendAlertMessage]:     '⚠️ Alerta enviado',
    [AutoModerationActionType.Timeout]:              '🔇 Timeout aplicado',
    [AutoModerationActionType.BlockMemberInteraction]: '🚫 Interação bloqueada',
};

EventCheckout.onAutoModerationRuleCreate('logs:autoModRuleCreate', async (rule: AutoModerationRule) => {
    const lm = await LogMinister.for(rule.guild);
    if (!lm || !lm.allows('automod')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.automod)
        .setDescription(`🛡️ Regra de AutoMod **${rule.name}** criada`)
        .addFields(
            { name: 'Tipo de gatilho', value: triggerLabel[rule.triggerType] ?? String(rule.triggerType), inline: true },
            { name: 'Habilitada',      value: rule.enabled ? 'Sim' : 'Não', inline: true },
            {
                name:  'Ações',
                value: rule.actions.map(a => actionLabel[a.type] ?? String(a.type)).join('\n') || '—',
            },
        )
        .addFields({ name: '\u200B', value: idBlock({ Rule: rule.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onAutoModerationRuleDelete('logs:autoModRuleDelete', async (rule: AutoModerationRule) => {
    const lm = await LogMinister.for(rule.guild);
    if (!lm || !lm.allows('automod')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`🛡️ Regra de AutoMod **${rule.name}** deletada`)
        .addFields({ name: '\u200B', value: idBlock({ Rule: rule.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onAutoModerationRuleUpdate('logs:autoModRuleUpdate', async (
    _old: AutoModerationRule | null,
    newRule: AutoModerationRule,
) => {
    const lm = await LogMinister.for(newRule.guild);
    if (!lm || !lm.allows('automod')) return;

    const embed = new EmbedBuilder()
        .setColor(LogColor.automod)
        .setDescription(`🛡️ Regra de AutoMod **${newRule.name}** atualizada`)
        .addFields(
            { name: 'Habilitada', value: newRule.enabled ? 'Sim' : 'Não', inline: true },
        )
        .addFields({ name: '\u200B', value: idBlock({ Rule: newRule.id }) })
        .setTimestamp();

    await lm.send(embed);
});

EventCheckout.onAutoModerationActionExecution('logs:autoModExecution', async (ex: AutoModerationActionExecution) => {
    // Guard: filtrar antes de qualquer I/O
    if (!ex.guild) return;
    const lm = await LogMinister.for(ex.guild);
    if (!lm || !lm.allows('automod')) return;

    const action = actionLabel[ex.action.type] ?? String(ex.action.type);
    const trigger = triggerLabel[ex.ruleTriggerType] ?? String(ex.ruleTriggerType);

    const embed = new EmbedBuilder()
        .setColor(LogColor.automod)
        .setDescription(`🛡️ AutoMod disparou — ${action}`)
        .addFields(
            { name: 'Usuário',        value: `<@${ex.userId}>`, inline: true },
            { name: 'Tipo de gatilho', value: trigger, inline: true },
            { name: 'Canal',          value: ex.channelId ? `<#${ex.channelId}>` : 'DM', inline: true },
            {
                name:  'Conteúdo bloqueado',
                value: truncate(ex.content || '*(sem conteúdo)*'),
            },
            ...(ex.matchedContent ? [{ name: 'Trecho que disparou', value: truncate(ex.matchedContent) }] : []),
        )
        .addFields({
            name:  '\u200B',
            value: idBlock({ User: ex.userId, Rule: ex.ruleId }),
        })
        .setTimestamp();

    await lm.send(embed);
});
