// RPTool/supercommands/censura/index.ts
// ─── Filtro de censura (estilo webhook proxy) ─────────────────────────────────
//
// Quando ligado (rp!censura on), mensagens com palavrão são apagadas e
// reenviadas via webhook com o nome/avatar do autor, com cada letra do termo
// trocada por █ — a mensagem continua visível, só o palavrão some.
//
//   rp!censura on|off          — liga/desliga (staff)
//   rp!censura add <termo>     — adiciona termo (aceita frases)
//   rp!censura remove <termo>  — remove termo custom OU desativa termo padrão
//   rp!censura list            — configuração atual
//   rp!censura ignore #canal   — isenta/reinclui um canal
//   rp!censura test <frase>    — mostra como uma frase sairia
//
// Integração com o proxy de OC (tools/webhook.ts):
//   • fala de personagem também sai censurada (registerProxyContentFilter);
//   • mensagens já consumidas pelo proxy não são reprocessadas (wasOCProxied).

import { Message, PartialMessage, PermissionFlagsBits, TextChannel } from 'discord.js';
import { EventCheckout } from '../../tools/eventCheckout';
import {
    sanitizeOutput,
    getOrCreateProxyWebhook,
    buildReplyEmbed,
    rememberOCMessage,
    registerProxyContentFilter,
    wasOCProxied,
} from '../../tools/webhook';
import {
    getGuildCensor,
    invalidateGuildCensor,
    applyCensorship,
    censorText,
    compileTerm,
    normalizeTerm,
} from './engine';
import { CensuraConfigModel } from '../../tools/models/CensuraConfig';
import { DEFAULT_TERMS } from './wordlist';

const PREFIX = 'rp!';

// Chaves normalizadas da lista padrão — pra saber se um termo é padrão ou custom.
let defaultKeys: Set<string> | null = null;
function getDefaultKeys(): Set<string> {
    if (!defaultKeys) defaultKeys = new Set(DEFAULT_TERMS.map(normalizeTerm));
    return defaultKeys;
}

// ─── Filtro de mensagens ──────────────────────────────────────────────────────

async function handleCensuraMessage(message: Message): Promise<void> {
    if (!message.guild || message.author.bot || message.webhookId) return;
    if (!message.content) return;
    // Comandos não são censurados — senão `rp!censura add <palavrão>` se autodestruiria
    if (message.content.toLowerCase().startsWith(PREFIX)) return;
    // O proxy de OC já apagou e reenviou esta mensagem (censurada lá pelo content filter)
    if (wasOCProxied(message.id)) return;

    const censor = await getGuildCensor(message.guild.id);
    if (!censor.enabled) return;

    const channel = message.channel;
    const channelIds = [channel.id];
    if (channel.isThread() && channel.parentId) channelIds.push(channel.parentId);
    if (channelIds.some(id => censor.ignored.has(id))) return;

    const { text, hits } = censorText(censor.list, message.content);
    if (!hits) return;

    try {
        let targetChannel = channel;
        let threadId: string | undefined;
        if (targetChannel.isThread()) {
            threadId = targetChannel.id;
            targetChannel = targetChannel.parent as TextChannel;
        }
        if (!targetChannel || !('fetchWebhooks' in targetChannel)) return;

        const webhook = await getOrCreateProxyWebhook(targetChannel as TextChannel);
        const files = Array.from(message.attachments.values()).map(a => a.url);
        const replyEmbed = await buildReplyEmbed(message);

        const sent = await webhook.send({
            content: sanitizeOutput(text) || '​',
            username: message.member?.displayName || message.author.username,
            avatarURL: (message.member ?? message.author).displayAvatarURL(),
            files,
            embeds: replyEmbed ? [replyEmbed] : [],
            threadId,
        });

        // Autor pode apagar a versão censurada reagindo ❌ (mesmo fluxo dos OCs)
        if (sent?.id) rememberOCMessage(sent.id, message.author.id);

        await message.delete().catch(() => {});
    } catch (e) {
        // Sem ManageWebhooks/ManageMessages a mensagem original fica no ar (fail-open)
        console.error('[Censura] Erro ao censurar mensagem:', e);
    }
}

// ─── Registro no dispatcher ───────────────────────────────────────────────────
// ⚠️ ORDEM IMPORTA: o proxy de OC (oc:proxy) precisa rodar ANTES deste filtro —
// mensagem com prefixo de personagem é apagada/reenviada lá (já censurada via
// content filter). Inscrever dentro do ClientReady garante que esta inscrição
// entra DEPOIS de todas as feitas em load-time, independente da ordem
// alfabética em que os módulos são carregados.
EventCheckout.onClientReady('censura:init', async () => {
    EventCheckout.onMessageCreate('censura:filter', handleCensuraMessage);

    // Editar a mensagem pra INCLUIR um palavrão também dispara o filtro.
    // Mensagem limpa editada (embed carregado, pin) não tem hit → sai barato.
    EventCheckout.onMessageUpdate('censura:filter:edit', async (_old, cur) => {
        let msg: Message | PartialMessage = cur;
        if (msg.partial) { try { msg = await msg.fetch(); } catch { return; } }
        await handleCensuraMessage(msg as Message);
    });
});

// Fala de OC (proxy de tools/webhook.ts) também passa pela censura.
registerProxyContentFilter(applyCensorship);

// ─── Comando rp!censura ───────────────────────────────────────────────────────

export default {
    name: 'censura',
    description: 'Filtro de palavrões: apaga e reenvia a mensagem com o termo em █.',
    aliases: ['censurar', 'filtro', 'palavrao'],

    async execute(message: Message, args: string[]) {
        if (!message.guild) return;
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ Apenas quem gerencia mensagens (staff) pode configurar a censura.');
        }

        const guildId = message.guild.id;
        const action = args[0]?.toLowerCase();

        try {
            switch (action) {
                case 'on':
                case 'ativar': {
                    await CensuraConfigModel.findOneAndUpdate(
                        { guildId }, { enabled: true }, { upsert: true }
                    );
                    invalidateGuildCensor(guildId);

                    // Aviso se o bot não tem as permissões que o filtro exige
                    const me = message.guild.members.me;
                    const faltando: string[] = [];
                    if (!me?.permissions.has(PermissionFlagsBits.ManageMessages)) faltando.push('`Gerenciar Mensagens`');
                    if (!me?.permissions.has(PermissionFlagsBits.ManageWebhooks)) faltando.push('`Gerenciar Webhooks`');
                    const aviso = faltando.length
                        ? `\n⚠️ Preciso de ${faltando.join(' e ')} pra apagar e reenviar as mensagens!`
                        : '';

                    return message.reply(`🔇 **Censura ativada!** Palavrões agora saem como █████.${aviso}`);
                }

                case 'off':
                case 'desativar': {
                    await CensuraConfigModel.findOneAndUpdate(
                        { guildId }, { enabled: false }, { upsert: true }
                    );
                    invalidateGuildCensor(guildId);
                    return message.reply('🔊 **Censura desativada.** As mensagens voltam a passar sem filtro.');
                }

                case 'add':
                case 'adicionar': {
                    const termo = args.slice(1).join(' ').toLowerCase().trim();
                    if (!termo) return message.reply('Uso: `rp!censura add <palavra ou frase>`');
                    if (!compileTerm(termo)) {
                        return message.reply('❌ Termo inválido — precisa ter pelo menos 2 letras/números.');
                    }

                    const key = normalizeTerm(termo);
                    const doc = await CensuraConfigModel.findOne({ guildId });

                    // Se era um termo padrão desativado, reativa em vez de duplicar
                    const disabledMatch = (doc?.disabledWords ?? []).filter(w => normalizeTerm(w) === key);
                    if (disabledMatch.length) {
                        await CensuraConfigModel.updateOne(
                            { guildId }, { $pull: { disabledWords: { $in: disabledMatch } } }
                        );
                        invalidateGuildCensor(guildId);
                        return message.reply(`✅ O termo ||${termo}|| voltou pra lista (estava desativado).`);
                    }

                    if (getDefaultKeys().has(key)) {
                        return message.reply('✅ Esse termo já está na lista padrão.');
                    }
                    if ((doc?.extraWords ?? []).some(w => normalizeTerm(w) === key)) {
                        return message.reply('✅ Esse termo já foi adicionado antes.');
                    }

                    await CensuraConfigModel.findOneAndUpdate(
                        { guildId }, { $addToSet: { extraWords: termo } }, { upsert: true }
                    );
                    invalidateGuildCensor(guildId);
                    return message.reply(`✅ Termo ||${termo}|| adicionado à censura. (variações com acento/leet são pegas automaticamente)`);
                }

                case 'remove':
                case 'remover': {
                    const termo = args.slice(1).join(' ').toLowerCase().trim();
                    if (!termo) return message.reply('Uso: `rp!censura remove <palavra ou frase>`');

                    const key = normalizeTerm(termo);
                    const doc = await CensuraConfigModel.findOne({ guildId });

                    // 1) termo custom → remove de vez
                    const extraMatch = (doc?.extraWords ?? []).filter(w => normalizeTerm(w) === key);
                    if (extraMatch.length) {
                        await CensuraConfigModel.updateOne(
                            { guildId }, { $pull: { extraWords: { $in: extraMatch } } }
                        );
                        invalidateGuildCensor(guildId);
                        return message.reply(`✅ Termo ||${termo}|| removido da censura.`);
                    }

                    // 2) termo da lista padrão → desativa só neste servidor
                    if (getDefaultKeys().has(key)) {
                        if ((doc?.disabledWords ?? []).some(w => normalizeTerm(w) === key)) {
                            return message.reply('✅ Esse termo padrão já estava desativado aqui.');
                        }
                        await CensuraConfigModel.findOneAndUpdate(
                            { guildId }, { $addToSet: { disabledWords: termo } }, { upsert: true }
                        );
                        invalidateGuildCensor(guildId);
                        return message.reply(`✅ Termo padrão ||${termo}|| desativado neste servidor. (\`rp!censura add\` reativa)`);
                    }

                    return message.reply('❌ Esse termo não está na lista padrão nem nos adicionados.');
                }

                case 'ignore':
                case 'ignorar':
                case 'canal': {
                    const canal = message.mentions.channels.first();
                    if (!canal) return message.reply('Uso: `rp!censura ignore #canal` — o canal alterna entre isento/filtrado.');

                    const doc = await CensuraConfigModel.findOne({ guildId });
                    const jaIsento = (doc?.ignoredChannels ?? []).includes(canal.id);

                    await CensuraConfigModel.findOneAndUpdate(
                        { guildId },
                        jaIsento
                            ? { $pull: { ignoredChannels: canal.id } }
                            : { $addToSet: { ignoredChannels: canal.id } },
                        { upsert: true }
                    );
                    invalidateGuildCensor(guildId);
                    return message.reply(jaIsento
                        ? `✅ ${canal} voltou a ser filtrado.`
                        : `✅ ${canal} agora é isento da censura (threads dele também).`);
                }

                case 'test':
                case 'teste': {
                    const frase = args.slice(1).join(' ');
                    if (!frase) return message.reply('Uso: `rp!censura test <frase>`');

                    const censor = await getGuildCensor(guildId);
                    const { text, hits } = censorText(censor.list, frase);
                    const estado = censor.enabled ? '' : '\n-# ⚠️ O filtro está desligado — `rp!censura on` pra valer de verdade.';
                    return message.reply(hits
                        ? `🔇 **${hits}** termo(s) censurado(s):\n>>> ${sanitizeOutput(text)}${estado}`
                        : `✅ Nenhum palavrão detectado nessa frase.${estado}`);
                }

                case 'list':
                case 'lista':
                case 'status':
                case undefined: {
                    const censor = await getGuildCensor(guildId);
                    return sendStatus(message, censor.enabled, censor.list.size, censor.extra, censor.disabled, [...censor.ignored]);
                }

                default:
                    return sendHelp(message);
            }
        } catch (e) {
            console.error(`[Censura] Erro em "${action}":`, e);
            return message.reply('🚨 Erro interno no filtro de censura. Tente novamente.');
        }
    },
};

// ─── Ajuda / status ───────────────────────────────────────────────────────────

function fmtTermos(termos: string[], max = 25): string {
    if (!termos.length) return '*nenhum*';
    const shown = termos.slice(0, max).map(t => `||${t}||`).join(', ');
    const resto = termos.length - max;
    return resto > 0 ? `${shown} *e mais ${resto}…*` : shown;
}

function sendStatus(
    message: Message, enabled: boolean, totalTermos: number,
    extras: string[], desativados: string[], canaisIsentos: string[],
) {
    const canais = canaisIsentos.length ? canaisIsentos.map(id => `<#${id}>`).join(', ') : '*nenhum*';
    return message.reply(
        `🔇 **Censura** — ${enabled ? '🟢 ativada' : '🔴 desativada'}\n\n` +
        `**Termos ativos:** ${totalTermos} (listas padrão pt-BR + inglês + ajustes do servidor)\n` +
        `**Adicionados aqui:** ${fmtTermos(extras)}\n` +
        `**Padrão desativados aqui:** ${fmtTermos(desativados)}\n` +
        `**Canais isentos:** ${canais}\n\n` +
        `Como funciona: a mensagem com palavrão é apagada e reenviada em seu nome ` +
        `(via webhook) com o termo em █████. Reagir ❌ apaga a versão censurada.\n` +
        `Use \`rp!censura help\` pra ver os subcomandos.`
    );
}

function sendHelp(message: Message) {
    return message.reply(
        `🔇 **Filtro de Censura**\n\n` +
        `\`rp!censura on\` / \`off\` — liga/desliga o filtro\n` +
        `\`rp!censura\` — status e configuração atual\n` +
        `\`rp!censura add <termo>\` — adiciona palavra ou frase à lista\n` +
        `\`rp!censura remove <termo>\` — remove termo custom ou desativa um da lista padrão\n` +
        `\`rp!censura ignore #canal\` — alterna isenção do canal (bom pra canais +18/OOC)\n` +
        `\`rp!censura test <frase>\` — simula a censura numa frase\n\n` +
        `A detecção ignora acento, maiúscula e "leet" (p0rr@ ≡ porra) e respeita ` +
        `fronteira de palavra (**cu**rso não é censurado). Termos ambíguos da lista ` +
        `padrão — *rola, pau, pinto, coco, foda* — podem ser desativados com \`remove\`.`
    );
}
