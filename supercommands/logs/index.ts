// RPTool/supercommands/logs/index.ts
// ─── Supercommand: Logs de Auditoria ─────────────────────────────────────────
// Canal de logs configurável por servidor — registra eventos do Discord
// para permitir busca reversa pela staff em caso de incidentes.
//
// ⚠️  A execução dos log handlers (pasta ./events/) é desacoplada deste index.
//     Os handlers são chamados pelos arquivos de /events/ APENAS quando o
//     servidor tiver logs ativados (LogMinister.isEnabled(guildId) === true).
//     Isso evita processamento desnecessário em servidores sem logs configurados.
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
import { extractArgs } from '../../tools/utils/textUtils';

// ─── Categorias de log disponíveis ────────────────────────────────────────────
// Cada categoria mapeia para um ou mais handlers em ./events/
// O ADM pode ativar/desativar categorias individualmente para controlar volume.
export const LOG_CATEGORIES = {
    members:       'Entradas, saídas e atualizações de membros',
    messages:      'Deleção e edição de mensagens',
    channels:      'Criação, edição e deleção de canais',
    roles:         'Criação, edição e deleção de cargos',
    moderation:    'Bans, unbans e entradas do audit log',
    voice:         'Movimentação em canais de voz',
    invites:       'Criação e deleção de convites',
    integrations:  'Bots e webhooks adicionados/removidos',
    expressions:   'Emojis, stickers e soundboard',
    threads:       'Threads criadas, editadas e deletadas',
    scheduled:     'Eventos agendados do servidor',
    automod:       'Execuções e regras do AutoMod',
    // Opt-in (volume muito alto — desativados por padrão):
    // reactions:  'Reações adicionadas e removidas',
    // presence:   'Status online/offline de membros',
    // typing:     'Indicador de digitação',
    // polls:      'Votos em enquetes',
} as const;

export type LogCategory = keyof typeof LOG_CATEGORIES;

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

        // Verificação de permissão
        const member = message.guild!.members.cache.get(message.author.id);
        if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ Apenas administradores podem configurar o sistema de logs.');
        }

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
            console.error('[Logs] Erro:', e);
            return message.reply('🚨 Erro ao configurar o sistema de logs.');
        }
    },
};

// ─── rp!logs set #canal ───────────────────────────────────────────────────────
async function handleSet(message: Message, args: string[]) {
    const mention = args[1];
    if (!mention?.startsWith('<#')) {
        return message.reply('⚠️ **Uso:** `rp!logs set #canal`\nO bot precisa ter permissão de **Enviar Mensagens** e **Inserir Links** nesse canal.');
    }

    const channelId = mention.replace(/[<#>]/g, '');
    const channel   = message.guild!.channels.cache.get(channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
        return message.reply('❌ Canal não encontrado ou não é um canal de texto.');
    }

    // Verifica se o bot tem permissões no canal de destino
    const botMember  = message.guild!.members.cache.get(message.client.user!.id);
    const perms      = (channel as TextChannel).permissionsFor(botMember!);
    if (!perms?.has(['SendMessages', 'EmbedLinks'])) {
        return message.reply(`❌ O bot não tem permissão de **Enviar Mensagens** e **Inserir Links** em ${channel}.`);
    }

    await LogModel.findOneAndUpdate(
        { guildId: message.guild!.id },
        { guildId: message.guild!.id, channelId, enabled: true },
        { upsert: true, new: true },
    );

    return message.reply(
        `✅ Canal de logs definido como ${channel}.\n` +
        `Os logs estão **ativos**. Use \`rp!logs categoria\` para ativar/desativar categorias específicas.\n` +
        `Use \`rp!logs test\` para verificar se está funcionando.`,
    );
}

// ─── rp!logs on / off ─────────────────────────────────────────────────────────
async function handleToggle(message: Message, enabled: boolean) {
    const config = await LogModel.findOne({ guildId: message.guild!.id });
    if (!config?.channelId) {
        return message.reply('❌ Nenhum canal de logs configurado. Use `rp!logs set #canal` primeiro.');
    }

    config.enabled = enabled;
    await config.save();

    return message.reply(enabled
        ? `✅ Logs **ativados** em <#${config.channelId}>.`
        : `⏸️ Logs **desativados**. O canal continua configurado; use \`rp!logs on\` para reativar.`,
    );
}

// ─── rp!logs status ───────────────────────────────────────────────────────────
async function handleStatus(message: Message) {
    const config = await LogModel.findOne({ guildId: message.guild!.id });

    const embed = new EmbedBuilder()
        .setColor(config?.enabled ? 'Green' : 'Red')
        .setTitle('📋 Status — Sistema de Logs')
        .addFields(
            {
                name:  '📺 Canal',
                value: config?.channelId ? `<#${config.channelId}>` : '*Não configurado*',
                inline: true,
            },
            {
                name:  '🔌 Status',
                value: config?.enabled ? '🟢 Ativo' : '🔴 Inativo',
                inline: true,
            },
        );

    // Exibe categorias ativas
    const activeCategories = Object.entries(LOG_CATEGORIES)
        .map(([key, desc]) => {
            const isActive = config?.categories?.includes(key as LogCategory) ?? true;
            return `${isActive ? '✅' : '❌'} \`${key}\` — ${desc}`;
        })
        .join('\n');

    embed.addFields({ name: '📂 Categorias', value: activeCategories, inline: false });
    embed.setFooter({ text: 'Use rp!logs categoria <nome> on/off para ativar/desativar categorias' });

    return message.reply({ embeds: [embed] });
}

// ─── rp!logs categoria <nome> on/off ──────────────────────────────────────────
async function handleCategory(message: Message, args: string[]) {
    const catName  = args[1]?.toLowerCase() as LogCategory;
    const toggle   = args[2]?.toLowerCase();

    if (!catName || !toggle) {
        const list = Object.entries(LOG_CATEGORIES)
            .map(([k, v]) => `▸ \`${k}\` — ${v}`)
            .join('\n');
        return message.reply(
            `⚠️ **Uso:** \`rp!logs categoria <nome> on|off\`\n\n**Categorias disponíveis:**\n${list}`,
        );
    }

    if (!LOG_CATEGORIES[catName]) {
        return message.reply(`❌ Categoria \`${catName}\` inválida. Use \`rp!logs categoria\` para ver a lista.`);
    }

    if (!['on', 'off', 'ativar', 'desativar'].includes(toggle)) {
        return message.reply('❌ Use `on` para ativar ou `off` para desativar.');
    }

    const enable = toggle === 'on' || toggle === 'ativar';
    const config = await LogModel.findOneAndUpdate(
        { guildId: message.guild!.id },
        enable
            ? { $addToSet: { categories: catName } }
            : { $pull:     { categories: catName } },
        { upsert: true, new: true },
    );

    return message.reply(
        `${enable ? '✅' : '❌'} Categoria **${catName}** ${enable ? 'ativada' : 'desativada'}.\n` +
        `-# ${LOG_CATEGORIES[catName]}`,
    );
}

// ─── rp!logs test ─────────────────────────────────────────────────────────────
async function handleTest(message: Message) {
    const config = await LogModel.findOne({ guildId: message.guild!.id });
    if (!config?.channelId || !config.enabled) {
        return message.reply('❌ Logs não estão configurados ou estão desativados. Use `rp!logs set #canal` primeiro.');
    }

    const channel = message.guild!.channels.cache.get(config.channelId) as TextChannel | undefined;
    if (!channel) return message.reply('❌ Canal de logs não encontrado. Reconfigure com `rp!logs set #canal`.');

    const testEmbed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🧪 Teste de Log')
        .setDescription(
            `Sistema de logs funcionando corretamente!\n` +
            `Testado por <@${message.author.id}> em <#${message.channel.id}>.`,
        )
        .setTimestamp();

    await channel.send({ embeds: [testEmbed] });
    return message.reply(`✅ Mensagem de teste enviada em ${channel}!`);
}

// ─── Painel de ajuda ──────────────────────────────────────────────────────────
function sendHelp(message: Message) {
    return message.reply(
        `📋 **Sistema de Logs — RPTool**\n\n` +
        `\`rp!logs set #canal\` — define o canal onde os logs serão enviados\n` +
        `\`rp!logs on\` — ativa os logs\n` +
        `\`rp!logs off\` — pausa os logs (sem perder a configuração)\n` +
        `\`rp!logs status\` — exibe canal, status e categorias ativas\n` +
        `\`rp!logs categoria <nome> on|off\` — ativa/desativa uma categoria específica\n` +
        `\`rp!logs test\` — envia uma mensagem de teste no canal configurado\n\n` +
        `-# ⚠️ Logs exigem permissões privilegiadas no Discord Developer Portal.\n` +
        `-# Necessário: GUILD_MEMBERS, MESSAGE_CONTENT, GUILD_PRESENCES (se aplicável).`,
    );
}