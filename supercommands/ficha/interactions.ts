// RPTool/supercommands/ficha/interactions.ts
import {
    EmbedBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    TextChannel,
} from 'discord.js';
import { FichaModel, TemplateModel } from '../../tools/models/FichaSchema';
import { OCModel, WikiModel }        from '../../tools/models/OCSchema';
import { compilarTemplate }          from './handlers/template';

// ─── Handler principal ────────────────────────────────────────────────────────

export async function handleFichaInteraction(interaction: any) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    // ── Modal: /ficha template (slash) ──
    if (interaction.isModalSubmit() && interaction.customId === 'ficha_templateModal') {
        const rawText = interaction.fields.getTextInputValue('template_text');
        const { fields, ocPrefixLabel } = compilarTemplate(rawText);

        if (fields.length === 0) {
            return interaction.reply({
                content: '❌ Nenhum campo válido encontrado. Use o formato `Campo: {tipo}` (ex: `Nome: {string_name}`).',
                ephemeral: true,
            });
        }

        await TemplateModel.findOneAndUpdate(
            { guildId: interaction.guildId },
            { guildId: interaction.guildId, rawText, fields, ocPrefixLabel },
            { upsert: true, new: true }
        );

        const fieldList = fields.map((f: any, i: number) => {
            let tags = (f.isName ? ' 🏷️nome' : '') + (f.isAvatar ? ' 🖼️avatar' : '') + (f.isPrefix ? ' 🔗prefix' : '');
            let extra = f.type === 'if' ? ` → Escolha: ${f.options.join(', ')}` : '';
            return `${i + 1}. **${f.name}**${tags}${extra}`;
        }).join('\n');

        return interaction.reply({
            content: `✅ **Modelo registrado com ${fields.length} campo(s):**\n${fieldList}`,
            ephemeral: true,
        });
    }

    // ── Botão: Rejeitar → abre Modal para motivo ──
    if (interaction.isButton() && interaction.customId.startsWith('ficha_reject_')) {
        const fichaId = interaction.customId.replace('ficha_reject_', '');

        const modal = new ModalBuilder()
            .setCustomId(`ficha_rejectModal_${fichaId}`)
            .setTitle('Motivo da Recusa');

        const reasonInput = new TextInputBuilder()
            .setCustomId('reject_reason')
            .setLabel('Motivo (será enviado ao jogador)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
        return interaction.showModal(modal);
    }

    // ── Modal: Motivo de rejeição enviado ──
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ficha_rejectModal_')) {
        const fichaId = interaction.customId.replace('ficha_rejectModal_', '');
        const reason  = interaction.fields.getTextInputValue('reject_reason');

        const ficha = await FichaModel.findById(fichaId);
        if (!ficha) {
            return interaction.reply({ content: '❌ Ficha não encontrada.', ephemeral: true });
        }

        ficha.status = 'rejected';
        await ficha.save();

        // Notifica o jogador na DM
        try {
            const user = await interaction.client.users.fetch(ficha.userId);
            const dm   = await user.createDM();
            await dm.send(
                `❌ Sua ficha **${ficha.characterName}** foi **recusada** em **${interaction.guild?.name}**.\n` +
                `> **Motivo:** ${reason}`
            );
        } catch { /* DM fechada, ignora */ }

        // Atualiza a mensagem de aprovação
        await interaction.update({
            content: `❌ Ficha de **${ficha.characterName}** RECUSADA por ${interaction.user.username}.`,
            components: [],
        });

        // Posta no canal de exibição
        await postarResultado(interaction, ficha, 'rejected', reason);
        return;
    }

    // ── Botão: Aprovar ──
    if (interaction.isButton() && interaction.customId.startsWith('ficha_approve_')) {
        const fichaId = interaction.customId.replace('ficha_approve_', '');
        const ficha   = await FichaModel.findById(fichaId);

        if (!ficha) {
            return interaction.reply({ content: '❌ Ficha não encontrada.', ephemeral: true });
        }

        ficha.status = 'approved';
        await ficha.save();

        const template = await TemplateModel.findOne({ guildId: interaction.guildId });

        // ── Integração com OC (se +oc foi habilitado na ficha) ──
        if (ficha.integrateOC && template) {
            const bioKeys  = ['história', 'historia', 'lore', 'bio', 'background'];
            let ocBio    = '';
            let ocPrefix = '';
            const ocExtras = new Map<string, string>();

            for (const [key, val] of Object.entries(ficha.data)) {
                const kLower = key.toLowerCase();

                if (template.ocPrefixLabel && kLower === template.ocPrefixLabel.toLowerCase()) {
                    ocPrefix = val as string;
                } else if (bioKeys.includes(kLower)) {
                    ocBio = val as string;
                } else if (key !== '__avatar__') {
                    ocExtras.set(key, String(val));
                }
            }

            try {
                const novoOC = await OCModel.create({
                    adminId: ficha.userId,
                    name:    ficha.characterName,
                    prefix:  ocPrefix || ficha.characterName.toLowerCase(),
                    suffix:  '',
                    avatar:  ficha.avatar,
                });

                await WikiModel.create({
                    ocId:       novoOC._id,
                    adminId:    ficha.userId,
                    bio:        ocBio,
                    extras:     ocExtras,
                    sections:   [],
                    references: [],
                    gallery:    [],
                });
            } catch (err) {
                console.error('[Ficha] Erro ao integrar OC/Wiki:', err);
            }
        }

        // Notifica o jogador na DM
        try {
            const user = await interaction.client.users.fetch(ficha.userId);
            const dm   = await user.createDM();
            const msg  = ficha.integrateOC
                ? `✅ Sua ficha **${ficha.characterName}** foi **aprovada** em **${interaction.guild?.name}**!\n🔗 Seu OC e webhook foram criados automaticamente.`
                : `✅ Sua ficha **${ficha.characterName}** foi **aprovada** em **${interaction.guild?.name}**!`;
            await dm.send(msg);
        } catch { /* DM fechada, ignora */ }

        // Atualiza a mensagem de aprovação
        const approvedLabel = ficha.integrateOC
            ? `✅ Ficha de **${ficha.characterName}** APROVADA por ${interaction.user.username}! (OC criado 🔗)`
            : `✅ Ficha de **${ficha.characterName}** APROVADA por ${interaction.user.username}!`;

        await interaction.update({ content: approvedLabel, components: [] });

        // Posta no canal de exibição
        await postarResultado(interaction, ficha, 'approved');
        return;
    }
}

// ─── Posta resultado no canal show ────────────────────────────────────────────

async function postarResultado(
    interaction: any,
    ficha: any,
    status: 'approved' | 'rejected',
    reason?: string
) {
    const template = await TemplateModel.findOne({ guildId: interaction.guildId });
    if (!template?.showChannelId) return;

    const showChannel = interaction.client.channels.cache.get(template.showChannelId) as TextChannel;
    if (!showChannel) return;

    const isApproved = status === 'approved';
    const color      = isApproved ? 0x57F287 : 0xED4245;
    const title      = isApproved
        ? `✅ Personagem Aprovado: ${ficha.characterName}`
        : `❌ Personagem Recusado: ${ficha.characterName}`;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setThumbnail(ficha.avatar || null)
        .setFooter({ text: `Decisão de ${interaction.user.username}` })
        .setTimestamp();

    if (!isApproved && reason) {
        embed.addFields({ name: 'Motivo da Recusa', value: reason });
    }

    if (isApproved) {
        for (const [key, val] of Object.entries(ficha.data as Record<string, any>)) {
            const strVal = String(val);
            if (strVal.startsWith('http')) continue;
            embed.addFields({ name: key, value: strVal.substring(0, 1024), inline: true });
        }
    }

    await showChannel.send({ embeds: [embed] });
}