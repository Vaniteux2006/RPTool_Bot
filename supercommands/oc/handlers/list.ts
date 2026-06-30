import { Message, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } from 'discord.js';
import { OCModel, IOC } from '../../../tools/models/OCSchema';

// Critérios de "Classificar por" disponíveis no menu. O default é data de criação.
// `dir` é a direção natural do critério (ex: data = mais novo primeiro); o botão de inverter troca o sinal.
const SORTS: Record<string, { label: string; emoji: string; field: string; dir: 1 | -1 }> = {
    createdAt: { label: 'Data de criação', emoji: '📅', field: 'createdAt', dir: -1 },
    name: { label: 'Nome (A-Z)', emoji: '🔤', field: 'name', dir: 1 },
    messageCount: { label: 'Nº de mensagens', emoji: '💬', field: 'messageCount', dir: -1 },
    realBirthday: { label: 'Aniversário', emoji: '🎉', field: 'realBirthday', dir: 1 },
};

export default async function handleList(message: Message, args: string[], userId: string) {
    let targetId = userId;
    if (message.mentions.users.first()) {
        targetId = message.mentions.users.first()!.id;
    } else if (args[1] && args[1].length > 15) {
        targetId = args[1];
    }

    const query = { $or: [{ adminId: targetId }, { duoIds: targetId }] };
    const totalDocs = await OCModel.countDocuments(query);
    if (totalDocs === 0) return message.reply("📭 Nenhum OC encontrado.");

    const pageSize = 5;
    const totalPages = Math.ceil(totalDocs / pageSize);

    // Estado da view (mutável conforme o usuário interage)
    let currentPage = 1;
    let sortKey = 'createdAt';
    let grouped = false;
    let reversed = false;

    // Spec de ordenação pro Mongo, já aplicando a inversão se ativa.
    const sortSpec = (): Record<string, 1 | -1> => {
        const { field, dir } = SORTS[sortKey];
        return { [field]: (reversed ? -dir : dir) as 1 | -1 };
    };

    // Renderiza um único OC. Em modo agrupado a linha "📂 Grupo" é omitida (já há cabeçalho).
    const renderOc = (t: IOC, includeGroupLine: boolean) => {
        const isOwner = t.adminId === targetId;
        const icon = isOwner ? "👑" : "🤝";
        const aiStatus = t.ai?.enabled ? "🤖 [IA ON]" : "";
        const created = t.createdAt ? t.createdAt.toLocaleDateString('pt-BR') : "Desconhecido";
        const bday = t.realBirthday ? ` | 🎉 ${t.realBirthday.getDate()}/${t.realBirthday.getMonth() + 1}` : "";
        const groupLine = includeGroupLine ? `\n> 📂 **Grupo:** ${t.group || "Nenhum"}` : "";

        return `**${icon} ${t.name}** ${aiStatus}\n> 🗣️ **Padrão:** \`${t.prefix}text${t.suffix}\`\n> 💬 **Msgs:** ${t.messageCount}${groupLine}\n> 📅 **Criado:** ${created}${bday}\n> 🖼️ [Ver Avatar](${t.avatar})`;
    };

    // Ordena os grupos: nomeados em ordem alfabética, "Sem grupo" (null) por último,
    // preservando a ordenação do sortKey dentro de cada grupo.
    const orderByGroup = (all: IOC[]) => {
        const seen = new Set<string>();
        const namedKeys: string[] = [];
        for (const o of all) {
            if (o.group && !seen.has(o.group)) { seen.add(o.group); namedKeys.push(o.group); }
        }
        namedKeys.sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const keys: (string | null)[] = [...namedKeys];
        if (all.some(o => !o.group)) keys.push(null);

        const ordered: IOC[] = [];
        for (const k of keys) for (const o of all) if ((o.group || null) === k) ordered.push(o);
        return ordered;
    };

    const generateEmbed = async () => {
        const skip = (currentPage - 1) * pageSize;
        const sortLabel = `${SORTS[sortKey].label}${reversed ? ' (invertido)' : ''}`;

        if (grouped) {
            const all = await OCModel.find(query).sort(sortSpec());
            const ordered = orderByGroup(all);
            const slice = ordered.slice(skip, skip + pageSize);

            const parts: string[] = [];
            let lastGroup: string | undefined;
            for (const oc of slice) {
                const g = oc.group || "Sem grupo";
                if (g !== lastGroup) { parts.push(`__**📂 ${g}**__`); lastGroup = g; }
                parts.push(renderOc(oc, false));
            }

            return {
                embeds: [{
                    title: `🗂️ OCs por Grupo (${currentPage}/${totalPages})`,
                    description: parts.join("\n\n"),
                    color: 0xFFFF00,
                    footer: { text: `Total de OCs: ${totalDocs} • Ordenado por ${sortLabel}` },
                    thumbnail: { url: slice[0]?.avatar }
                }]
            };
        }

        const ocs = await OCModel.find(query).sort(sortSpec()).skip(skip).limit(pageSize);
        const listStr = ocs.map(t => renderOc(t, true)).join("\n\n");

        return {
            embeds: [{
                title: `📒 Lista de OCs (${currentPage}/${totalPages})`,
                description: listStr,
                color: 0xFFFF00,
                footer: { text: `Total de OCs: ${totalDocs} • Ordenado por ${sortLabel}` },
                thumbnail: { url: ocs[0]?.avatar }
            }]
        };
    };

    // (Re)constrói os controles conforme o estado atual.
    const buildRows = () => {
        const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

        if (totalPages > 1) {
            const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('prev_page').setLabel('⬅️ Anterior').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 1),
                new ButtonBuilder().setCustomId('jump_page').setLabel('🔢 Pular').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('next_page').setLabel('Próximo ➡️').setStyle(ButtonStyle.Primary).setDisabled(currentPage === totalPages),
            );
            rows.push(navRow as ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>);
        }

        const sortRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('sort_select')
                .setPlaceholder('↕️ Classificar por...')
                .addOptions(Object.entries(SORTS).map(([k, v]) => ({
                    label: v.label, value: k, emoji: v.emoji, default: k === sortKey
                })))
        );
        rows.push(sortRow as ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>);

        const groupRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('toggle_group')
                .setLabel(grouped ? 'Agrupando por grupo' : 'Agrupar por grupo')
                .setEmoji('🗂️')
                .setStyle(grouped ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('toggle_dir')
                .setLabel(reversed ? 'Ordem invertida' : 'Inverter ordem')
                .setEmoji('🔃')
                .setStyle(reversed ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
        rows.push(groupRow as ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>);

        return rows;
    };

    const render = async () => {
        const { embeds } = await generateEmbed();
        return { embeds, components: buildRows() };
    };

    const msg = await message.reply(await render());

    const collector = msg.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async (i) => {
        if (i.user.id !== userId) {
            return i.reply({ content: "🚫 Só quem pediu a lista pode mexer.", ephemeral: true });
        }

        // Trocar ordenação (reseta a inversão pro critério novo começar na direção natural)
        if (i.isStringSelectMenu() && i.customId === 'sort_select') {
            sortKey = i.values[0];
            reversed = false;
            currentPage = 1;
            return i.update(await render());
        }

        if (!i.isButton()) return;

        // Ligar/desligar agrupamento
        if (i.customId === 'toggle_group') {
            grouped = !grouped;
            currentPage = 1;
            return i.update(await render());
        }

        // Inverter ordem
        if (i.customId === 'toggle_dir') {
            reversed = !reversed;
            currentPage = 1;
            return i.update(await render());
        }

        // Pular para página (modal)
        if (i.customId === 'jump_page') {
            const modal = new ModalBuilder()
                .setCustomId('modal_jump_page')
                .setTitle('Pular para Página');

            const pageInput = new TextInputBuilder()
                .setCustomId('page_input')
                .setLabel(`Digite a página (1 a ${totalPages}):`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(pageInput));
            await i.showModal(modal);

            try {
                const modalSubmit = await i.awaitModalSubmit({
                    filter: m => m.user.id === userId && m.customId === 'modal_jump_page',
                    time: 60000
                });

                const inputPage = parseInt(modalSubmit.fields.getTextInputValue('page_input'));
                if (isNaN(inputPage) || inputPage < 1 || inputPage > totalPages) {
                    return modalSubmit.reply({ content: `❌ Página inválida. Digite um número de 1 a ${totalPages}.`, ephemeral: true });
                }

                currentPage = inputPage;
                const data = await render();

                if (modalSubmit.isFromMessage()) {
                    await modalSubmit.update(data);
                } else {
                    await modalSubmit.deferUpdate();
                    await msg.edit(data);
                }
            } catch (e) {
                console.warn('[OC/LIST] Erro ou timeout no modal de pular página:', e);
            }
            return;
        }

        // Navegação
        if (i.customId === 'prev_page' && currentPage > 1) currentPage--;
        if (i.customId === 'next_page' && currentPage < totalPages) currentPage++;

        return i.update(await render());
    });

    collector.on('end', () => {
        const rows = buildRows();
        rows.forEach(r => r.components.forEach(c => c.setDisabled(true)));
        msg.edit({ components: rows }).catch(() => { });
    });
}
