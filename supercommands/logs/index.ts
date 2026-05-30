// RPTool/supercommands/logs/index.ts
// ─── Supercommand: Logs de Auditoria ─────────────────────────────────────────
// Substitui a versão anterior — adiciona imports dos novos arquivos e
// as categorias 'reactions' e 'polls' no LOG_CATEGORIES.

// ── Carrega todos os subscribers de log ──────────────────────────────────────
import './events/Invitelogs';
import './events/Integrationlogs';
import './events/Expressionlogs';          // inclui soundboard (atualizado)
import './events/Automoderationlogs';
import './events/scheduledEventLogs';
import './events/GuildLifecycleLogs';      // ← novo: GUILD_CREATE / GUILD_DELETE
import './events/ChannelPinsLogs';         // ← novo: CHANNEL_PINS_UPDATE
import './events/StageInstanceUpdateLogs'; // ← novo: STAGE_INSTANCE_UPDATE
import './events/Voicelogs';
import './events/GuildLogs';
import './events/Moderationlogs';
import './events/Memberlogs';
import './events/Messagelogs';
import './events/ReactionLogs';            // ← novo: REACTION_ADD/REMOVE/ALL/EMOJI (opt-in)
import './events/PollLogs';               // ← novo: POLL_VOTE_ADD/REMOVE (opt-in)
import './events/VoiceChannelEffectLogs'; // ← novo: VOICE_CHANNEL_EFFECT_SEND (comentado)

import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Message,
    EmbedBuilder,
    PermissionFlagsBits,
    TextChannel,
    ChannelType,
} from 'discord.js';
import { LogModel } from '../../tools/models/LogConfig';

// ─── Categorias de log disponíveis ────────────────────────────────────────────
export const LOG_CATEGORIES = {
    // ── Ativas por padrão ─────────────────────────────────────────────────────
    members:       'Entradas, saídas e atualizações de membros',
    messages:      'Deleção e edição de mensagens',
    channels:      'Canais, threads, pins e stage',
    roles:         'Criação, edição e deleção de cargos',
    moderation:    'Bans, unbans, kicks e timeouts',
    voice:         'Movimentação em canais de voz',
    invites:       'Criação e deleção de convites',
    integrations:  'Bots, webhooks e integrações',
    expressions:   'Emojis, stickers e soundboard',
    scheduled:     'Eventos agendados do servidor',
    automod:       'Execuções e regras do AutoMod',

    // ── Opt-in (volume alto — desativadas por padrão) ─────────────────────────
    reactions:     '⚠️ [OPT-IN] Reações adicionadas e removidas',
    polls:         '⚠️ [OPT-IN] Votos em enquetes',
} as const;

export type LogCategory = keyof typeof LOG_CATEGORIES;

// Categorias opt-in — desativadas por padrão mesmo sem configuração explícita
const OPT_IN_CATEGORIES = new Set<LogCategory>(['reactions', 'polls']);

export default {
    name:        'logs',
    description: 'Sistema de logs de auditoria do servidor',
    aliases:     ['log', 'auditoria'],

    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Configura o sistema de logs do servidor')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        return interaction.reply({ content: 'Use `rp!logs` para configurar.', ephemeral: true });
    },

    async execute(message: Message, args: string[]) {
        const action = args[0]?.toLowerCase();
        if (!action) return sendHelp(message);

        const member = message.guild!.members.cache.get(message.author.id);
        if (!member?.permissions.has(PermissionFlagsBits.ManageGuild))
            return message.reply('❌ Apenas administradores podem configurar o sistema de logs.');

        try {
            switch (action) {
                case 'set':
                case 'canal':
                    return await handleSet(message, args);
                case 'on':
                case 'ativar':
                    return await handleToggle(message, true);
                case 'off':
                case 'desativar':
                    return await handleToggle(message, false);
                case 'status':
                case 'info':
                    return await handleStatus(message);
                case 'categoria':
                case 'cat':
                    return await handleCategory(message, args);
                case 'test':
                case 'testar':
                    return await handleTest(message);
                default:
                    return message.reply(`❌ Subcomando \`${action}\` desconhecido. Use \`rp!logs\` para ajuda.`);
            }
        } catch (e) {
            console.error('[logs] Erro:', e);
            return message.reply('❌ Erro interno ao processar o comando de logs.');
        }
    },
};

// ─── Handlers internos ────────────────────────────────────────────────────────

async function handleSet(message: Message, args: string[]) {
    const channel = message.mentions.channels.first();
    if (!channel || channel.type !== ChannelType.GuildText)
        return message.reply('❌ Mencione um canal de texto válido.\n`rp!logs set #canal`');

    await LogModel.findOneAndUpdate(
        { guildId: message.guild!.id },
        { channelId: channel.id, enabled: true },
        { upsert: true, new: true },
    );
    return message.reply(
        `✅ **Canal de logs definido para ${channel} e logs ativados!**\n` +
        `Use \`rp!logs categoria\` para controlar quais eventos registrar.`,
    );
}

async function handleToggle(message: Message, enable: boolean) {
    const config = await LogModel.findOneAndUpdate(
        { guildId: message.guild!.id },
        { enabled: enable },
        { upsert: true, new: true },
    );
    if (enable && !config?.channelId)
        return message.reply('⚠️ Logs ativados, mas **nenhum canal configurado ainda**. Use `rp!logs set #canal`.');
    return message.reply(enable
        ? `🔛 **Logs ativados!** Registrando no canal <#${config.channelId}>.`
        : '📴 **Logs desativados.** Os eventos deixarão de ser registrados.',
    );
}

async function handleStatus(message: Message) {
    const config = await LogModel.findOne({ guildId: message.guild!.id });
    if (!config)
        return message.reply('📋 Logs não configurados. Use `rp!logs set #canal` para começar.');

    const categorias = Object.entries(LOG_CATEGORIES)
        .map(([key, desc]) => {
            const cat    = key as LogCategory;
            const isOptIn = OPT_IN_CATEGORIES.has(cat);
            // Opt-in: só ativo se explicitamente true. Normal: ativo a menos que false.
            const ativo  = isOptIn
                ? config.categories?.[key] === true
                : config.categories?.[key] !== false;
            const icon   = ativo ? '✅' : '❌';
            const optTag = isOptIn ? ' `[OPT-IN]`' : '';
            return `${icon} **${key}**${optTag} — ${desc.replace('⚠️ [OPT-IN] ', '')}`;
        })
        .join('\n');

    const embed = new EmbedBuilder()
        .setTitle('📋 Status dos Logs')
        .setColor(config.enabled ? 0x57F287 : 0xFF0000)
        .addFields(
            { name: 'Estado',  value: config.enabled ? '🟢 Ativo' : '🔴 Desativado', inline: true },
            { name: 'Canal',   value: config.channelId ? `<#${config.channelId}>` : 'Não definido', inline: true },
            { name: 'Categorias', value: categorias },
        );

    return message.reply({ embeds: [embed] });
}

async function handleCategory(message: Message, args: string[]) {
    const categoria = args[1]?.toLowerCase() as LogCategory | undefined;
    const estado    = args[2]?.toLowerCase();

    if (!categoria || !(categoria in LOG_CATEGORIES)) {
        const lista = Object.entries(LOG_CATEGORIES)
            .map(([k, v]) => `\`${k}\`${OPT_IN_CATEGORIES.has(k as LogCategory) ? ' ⚠️' : ''} — ${v.replace('⚠️ [OPT-IN] ', '')}`)
            .join('\n');
        return message.reply(
            `📂 **Categorias disponíveis:**\n${lista}\n\n` +
            `⚠️ = opt-in (volume alto, desativada por padrão)\n` +
            `*Uso: \`rp!logs categoria <nome> on|off\`*`,
        );
    }

    if (!estado || !['on', 'off'].includes(estado))
        return message.reply(`❓ Use \`rp!logs categoria ${categoria} on\` ou \`...off\``);

    await LogModel.findOneAndUpdate(
        { guildId: message.guild!.id },
        { [`categories.${categoria}`]: estado === 'on' },
        { upsert: true },
    );

    const optWarn = OPT_IN_CATEGORIES.has(categoria) && estado === 'on'
        ? '\n⚠️ Esta categoria tem **volume alto** — monitore o canal de logs.'
        : '';

    return message.reply(
        `${estado === 'on' ? '✅' : '❌'} Categoria **${categoria}** ${estado === 'on' ? 'ativada' : 'desativada'}.${optWarn}`,
    );
}

async function handleTest(message: Message) {
    const config = await LogModel.findOne({ guildId: message.guild!.id });
    if (!config?.channelId || !config.enabled)
        return message.reply('❌ Configure e ative os logs antes de testar. Use `rp!logs set #canal`.');

    const channel = message.guild!.channels.cache.get(config.channelId);
    if (!channel?.isTextBased())
        return message.reply('❌ Canal configurado não encontrado ou não é de texto.');

    const embed = new EmbedBuilder()
        .setTitle('🧪 Teste de Logs')
        .setColor(0x5865F2)
        .setDescription('Sistema de logs funcionando corretamente!')
        .addFields(
            { name: 'Solicitado por', value: `<@${message.author.id}>`, inline: true },
            { name: 'Canal',          value: `<#${config.channelId}>`,   inline: true },
        )
        .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });
    return message.reply('✅ Mensagem de teste enviada!');
}

async function sendHelp(message: Message) {
    const embed = new EmbedBuilder()
        .setTitle('📋 Sistema de Logs — Ajuda')
        .setColor(0x5865F2)
        .setDescription('Registra eventos do servidor para auditoria pela staff.')
        .addFields(
            {
                name:  '⚙️ Configuração',
                value: '`rp!logs set #canal` — define o canal e ativa\n`rp!logs on` — ativa\n`rp!logs off` — pausa',
            },
            {
                name:  '📊 Monitoramento',
                value: '`rp!logs status` — estado atual e categorias\n`rp!logs categoria <nome> on|off` — controla categorias\n`rp!logs test` — envia mensagem de teste',
            },
        );

    return message.reply({ embeds: [embed] });
}
