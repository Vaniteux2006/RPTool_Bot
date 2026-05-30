// RPTool/supercommands/logs/events/PollLogs.ts
// ─── Log: Enquetes ────────────────────────────────────────────────────────────
// Intent: GUILD_MESSAGE_POLLS (1 << 24)
// Eventos: MESSAGE_POLL_VOTE_ADD · MESSAGE_POLL_VOTE_REMOVE
//
// ⚠️ VOLUME POTENCIALMENTE ALTO — opt-in, desativado por padrão.
//    Para ativar: rp!logs categoria polls on
//
// ⚠️ PollAnswer não expõe o texto da opção diretamente — é necessário buscar
//    a mensagem original para pegar o label da opção pelo answerId.
//    Estratégia: buscar a mensagem, cruzar poll.answers[answerId].text.
//    Se a mensagem não estiver mais disponível, exibir apenas o answerId.
//
// ⚠️ DIRECT_MESSAGE_POLLS (1 << 25) está REMOVIDO intencionalmente dos intents
//    (open source). Esses handlers só processam votos de servidores.

import { PollAnswer, EmbedBuilder, TextChannel } from 'discord.js';
import { EventCheckout } from '../../../tools/event_checkout';
import { LogMinister, LogColor, idBlock, truncate } from '../utils/LogMinister';

// ─── Helper: busca o texto da opção pelo answerId ─────────────────────────────
async function getAnswerText(answer: PollAnswer): Promise<string> {
    try {
        const msg = await answer.poll.message.fetch();
        const opt = msg.poll?.answers.get(answer.id);
        const emoji = opt?.emoji ? `${opt.emoji} ` : '';
        return `${emoji}${opt?.text ?? `Opção #${answer.id}`}`;
    } catch {
        return `Opção #${answer.id}`;
    }
}

// ─── Poll Vote Add ────────────────────────────────────────────────────────────
EventCheckout.onMessagePollVoteAdd('logs:pollVoteAdd', async (answer: PollAnswer, userId: string) => {
    const msg = answer.poll.message;
    if (!msg.guildId) return; // ignorar DMs (intent não está ativo, mas por segurança)

    const guild = msg.guild!;
    const lm    = await LogMinister.for(guild);
    // Categoria 'polls' — opt-in
    if (!lm || !lm.allows('polls' as any)) return;

    const answerText = await getAnswerText(answer);
    const jumpUrl    = msg.url;

    const embed = new EmbedBuilder()
        .setColor(LogColor.join)
        .setDescription(`📊 <@${userId}> votou numa enquete em <#${msg.channelId}>`)
        .addFields(
            { name: 'Opção escolhida', value: truncate(answerText), inline: true },
            { name: 'Canal',           value: `<#${msg.channelId}>`, inline: true },
            { name: 'Enquete',         value: `[Ir para a enquete](${jumpUrl})` },
        )
        .addFields({
            name:  '\u200B',
            value: idBlock({ User: userId, Message: msg.id }),
        })
        .setTimestamp();

    await lm.send(embed);
});

// ─── Poll Vote Remove ─────────────────────────────────────────────────────────
EventCheckout.onMessagePollVoteRemove('logs:pollVoteRemove', async (answer: PollAnswer, userId: string) => {
    const msg = answer.poll.message;
    if (!msg.guildId) return;

    const guild = msg.guild!;
    const lm    = await LogMinister.for(guild);
    if (!lm || !lm.allows('polls' as any)) return;

    const answerText = await getAnswerText(answer);
    const jumpUrl    = msg.url;

    const embed = new EmbedBuilder()
        .setColor(LogColor.leave)
        .setDescription(`📊 <@${userId}> removeu o voto numa enquete em <#${msg.channelId}>`)
        .addFields(
            { name: 'Opção desfeita', value: truncate(answerText), inline: true },
            { name: 'Canal',          value: `<#${msg.channelId}>`, inline: true },
            { name: 'Enquete',        value: `[Ir para a enquete](${jumpUrl})` },
        )
        .addFields({
            name:  '\u200B',
            value: idBlock({ User: userId, Message: msg.id }),
        })
        .setTimestamp();

    await lm.send(embed);
});
