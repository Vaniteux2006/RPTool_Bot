// RPTool/supercommands/ficha/index.ts
import {
    Message,
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ChannelType,
    EmbedBuilder,
} from 'discord.js';
import handleTemplate        from './handlers/template';
import handleView            from './handlers/view';
import handleNew             from './handlers/new';
import handleCheck           from './handlers/check';
import handleShow            from './handlers/show';
import handleSubmit          from './handlers/submit';
import { handleAutoDetect }  from './handlers/autodetect';
import { EventCheckout }     from '../../tools/event_checkout';
import { TemplateModel }     from '../../tools/models/FichaSchema';

// Registra o listener de auto-detecção de fichas no canal de envio
EventCheckout.onMessageCreate('ficha:autodetect', handleAutoDetect);

// ─── Help ─────────────────────────────────────────────────────────────────────
const HELP = `
📋 **Sistema de Fichas — rp!ficha**

\`rp!ficha template\`        → Cria/edita o modelo de ficha do servidor *(admin)*
\`rp!ficha check #canal\`    → Define o canal de aprovação das fichas *(admin)*
\`rp!ficha show #canal\`     → Define o canal público de exibição de resultados *(admin)*
\`rp!ficha submit #canal\`   → Define o canal onde os jogadores postam as fichas diretamente *(admin)*
\`rp!ficha view\`            → Exibe o modelo atual e os canais configurados

\`rp!ficha new\`             → Preenche a ficha na DM
\`rp!ficha new +oc\`         → Preenche a ficha e cria o OC automaticamente ao ser aprovado
`.trim();

// ─── Slash command definition ─────────────────────────────────────────────────
const fichaSlash = new SlashCommandBuilder()
    .setName('ficha')
    .setDescription('Sistema de fichas de personagem para RP')
    // Jogadores
    .addSubcommand(sub => sub
        .setName('new')
        .setDescription('Preenche a ficha na DM')
        .addBooleanOption(o => o
            .setName('oc')
            .setDescription('Criar OC automaticamente ao ser aprovado?')
            .setRequired(false)
        )
    )
    .addSubcommand(sub => sub
        .setName('view')
        .setDescription('Exibe o modelo atual e os canais configurados')
    )
    // Admins — canais
    .addSubcommand(sub => sub
        .setName('check')
        .setDescription('Define o canal de aprovação de fichas (admin)')
        .addChannelOption(o => o
            .setName('canal')
            .setDescription('Canal onde as fichas chegam para avaliação')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('show')
        .setDescription('Define o canal de exibição de resultados (admin)')
        .addChannelOption(o => o
            .setName('canal')
            .setDescription('Canal onde aprovações e recusas são exibidas')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('submit')
        .setDescription('Define o canal onde jogadores postam fichas diretamente (admin)')
        .addChannelOption(o => o
            .setName('canal')
            .setDescription('Canal de envio livre de fichas')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    // Admin — template
    .addSubcommand(sub => sub
        .setName('template')
        .setDescription('Cria ou edita o modelo de ficha do servidor (admin)')
    );

export default {
    name: 'ficha',
    aliases: ['form', 'sheet'],
    description: 'Sistema automático de Fichas (RP)',
    data: fichaSlash,

    // ─── Prefix command ───────────────────────────────────────────────────────
    execute: async (message: Message, args: string[]) => {
        const action = args[0]?.toLowerCase();

        switch (action) {
            case 'template':
                return handleTemplate(message, args.slice(1));
            case 'check':
                return handleCheck(message, args.slice(1));
            case 'show':
                return handleShow(message, args.slice(1));
            case 'submit':
            case 'canal':
                return handleSubmit(message, args.slice(1));
            case 'view':
            case 'edit':
                return handleView(message, args.slice(1));
            case 'new':
            case 'start':
                return handleNew(message, args.slice(1));
            default:
                return message.reply(HELP);
        }
    },

    // ─── Slash command handler ────────────────────────────────────────────────
    executeSlash: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();

        // ── /ficha new ──
        if (sub === 'new') {
            const integrateOC = interaction.options.getBoolean('oc') ?? false;
            // fakeMessage para reutilizar o handler existente
            const fakeMessage: any = {
                author:   interaction.user,
                guild:    interaction.guild,
                guildId:  interaction.guildId,
                client:   interaction.client,
                member:   interaction.member,
                mentions: { channels: { first: () => null } },
                reply:    (payload: any) => interaction.replied || interaction.deferred
                    ? interaction.followUp(payload)
                    : interaction.reply(payload),
            };
            return handleNew(fakeMessage, integrateOC ? ['+oc'] : []);
        }

        // ── /ficha view ──
        if (sub === 'view') {
            const template = await TemplateModel.findOne({ guildId: interaction.guildId });
            if (!template || !template.fields?.length) {
                return interaction.reply({ content: '❌ Este servidor ainda não tem um modelo de ficha. Use `/ficha template`.', ephemeral: true });
            }

            const TYPE_LABEL: Record<string, string> = {
                string: 'Texto', int: 'Número inteiro', float: 'Número decimal',
                image: 'Imagem / Anexo', prefix: 'Prefixo do webhook', if: 'Escolha',
            };

            const checkInfo  = template.checkChannelId  ? `<#${template.checkChannelId}>`  : '*(não definido)*';
            const showInfo   = template.showChannelId   ? `<#${template.showChannelId}>`   : '*(não definido)*';
            const submitInfo = template.submitChannelId ? `<#${template.submitChannelId}>` : '*(não definido)*';

            let fieldDesc = '';
            template.fields.forEach((f: any, i: number) => {
                let tags = (f.isName ? ' 🏷️' : '') + (f.isAvatar ? ' 🖼️' : '') + (f.isPrefix ? ' 🔗' : '');
                let extra = TYPE_LABEL[f.type] ?? f.type;
                if (f.type === 'if' && f.options?.length) extra += `: ${f.options.join(', ')}`;
                fieldDesc += `\`${i + 1}.\` **${f.name}**${tags} — *${extra}*\n`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`📋 Modelo de Ficha — ${interaction.guild?.name}`)
                .setColor(0x2B2D31)
                .setDescription(
                    `**Canal de aprovação:** ${checkInfo}\n` +
                    `**Canal de exibição:** ${showInfo}\n` +
                    `**Canal de envio direto:** ${submitInfo}`
                )
                .addFields({ name: `Campos (${template.fields.length})`, value: fieldDesc });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // ── /ficha check | show | submit ── (admin, canal)
        if (sub === 'check' || sub === 'show' || sub === 'submit') {
            const member = interaction.guild?.members.cache.get(interaction.user.id)
                ?? await interaction.guild?.members.fetch(interaction.user.id);

            if (!member?.permissions.has('Administrator')) {
                return interaction.reply({ content: '❌ Apenas administradores podem usar este comando.', ephemeral: true });
            }

            const channel = interaction.options.getChannel('canal', true);
            const field   = sub === 'check' ? 'checkChannelId' : sub === 'show' ? 'showChannelId' : 'submitChannelId';
            const label   = sub === 'check' ? 'aprovação' : sub === 'show' ? 'exibição' : 'envio de fichas';

            await TemplateModel.findOneAndUpdate(
                { guildId: interaction.guildId },
                { [field]: channel.id },
                { upsert: true, new: true }
            );

            return interaction.reply({ content: `✅ Canal de **${label}** definido para <#${channel.id}>.`, ephemeral: true });
        }

        // ── /ficha template ── abre modal
        if (sub === 'template') {
            const member = interaction.guild?.members.cache.get(interaction.user.id)
                ?? await interaction.guild?.members.fetch(interaction.user.id);

            if (!member?.permissions.has('Administrator')) {
                return interaction.reply({ content: '❌ Apenas administradores podem usar este comando.', ephemeral: true });
            }

            // Carrega template atual para pré-preencher o modal
            const current = await TemplateModel.findOne({ guildId: interaction.guildId });

            const modal = new ModalBuilder()
                .setCustomId('ficha_templateModal')
                .setTitle('Modelo de Ficha');

            const input = new TextInputBuilder()
                .setCustomId('template_text')
                .setLabel('Formato: Campo: {tipo}')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Nome: {string_name}\nIdade: {int}\nGênero: {string} | if (Masc), (Fem)\nFoto: {anex}')
                .setRequired(true)
                .setMaxLength(4000);

            if (current?.rawText) input.setValue(current.rawText);

            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
            return interaction.showModal(modal);
        }
    },
};
