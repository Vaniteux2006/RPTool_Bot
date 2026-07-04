// RPTool/supercommands/token/interactions.ts
// ─── Roteador de interações do painel de chaves de IA ─────────────────────────
// Roteado pelo interactionCheckout via prefixo `token_`. Stateless: cada customId
// carrega o contexto necessário (uid e, quando preciso, keyId). Sem collectors.
//
// customId: `token_<ação>[:<keyId>]:<uid>`  — o uid é SEMPRE o último segmento.
import {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { TokenModel } from '../../tools/models/TokenSchema';
import { buildDashboardPayload, getMutualGuilds, fetchModels } from './index';
import { api } from '../../tools/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function backRow(uid: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`token_refresh:${uid}`).setLabel('Voltar ao painel').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
    );
}

async function backToDashboard(interaction: any, uid: string, note?: string): Promise<void> {
    const payload = await buildDashboardPayload(uid, interaction.client);
    const body = { content: note ?? null, embeds: payload.embeds, components: payload.components };
    if (interaction.replied || interaction.deferred) {
        await interaction.message?.edit(body).catch(() => {});
    } else {
        await interaction.update(body).catch(() => {});
    }
}

async function keySelectRow(uid: string, customId: string, placeholder: string) {
    const ud = await TokenModel.findOne({ userId: uid });
    const keys = ud?.keys ?? [];
    if (keys.length === 0) return null;
    const options = keys.slice(0, 25).map(k => ({
        label: (k.name || k.id).slice(0, 100),
        description: `${k.provider} · ${k.model || 'sem modelo'}`.slice(0, 100),
        value: k.id,
    }));
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options),
    );
}

const promptScreen = (interaction: any, content: string, row: any) =>
    interaction.update({ content, embeds: [], components: [row] });

// ─── Handler principal ────────────────────────────────────────────────────────
export async function handleTokenInteraction(interaction: any): Promise<void> {
    const id: string = interaction.customId;
    const parts = id.split(':');
    const action = parts[0];
    const uid = parts[parts.length - 1];

    // Painel é sempre em DM (só o dono interage), mas garantimos:
    if (interaction.user.id !== uid) {
        await interaction.reply({ content: '🔒 Esse painel não é seu.' }).catch(() => {});
        return;
    }

    try {
        // ════ BOTÕES DO PAINEL ════════════════════════════════════════════════
        if (interaction.isButton()) {
            switch (action) {
                case 'token_refresh':
                    return await backToDashboard(interaction, uid);

                case 'token_add': {
                    const modal = new ModalBuilder().setCustomId(`token_addmod:${uid}`).setTitle('Adicionar chave de IA');
                    const nameInput = new TextInputBuilder().setCustomId('name').setLabel('Nome (opcional)')
                        .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(60);
                    const keyInput = new TextInputBuilder().setCustomId('key').setLabel('Chave de API (AIza… do Gemini ou sk-… da OpenAI)')
                        .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200);
                    modal.addComponents(
                        new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
                        new ActionRowBuilder<TextInputBuilder>().addComponents(keyInput),
                    );
                    return await interaction.showModal(modal);
                }

                case 'token_rename': {
                    const row = await keySelectRow(uid, `token_rensel:${uid}`, 'Escolha a chave para renomear');
                    return row
                        ? await promptScreen(interaction, '✏️ Qual chave você quer renomear?', row)
                        : await promptScreen(interaction, '⚠️ Você não tem chaves. Adicione uma primeiro.', backRow(uid));
                }

                case 'token_model': {
                    const row = await keySelectRow(uid, `token_modsel:${uid}`, 'Escolha a chave');
                    return row
                        ? await promptScreen(interaction, '🧠 Trocar o modelo de qual chave?', row)
                        : await promptScreen(interaction, '⚠️ Você não tem chaves. Adicione uma primeiro.', backRow(uid));
                }

                case 'token_del': {
                    const row = await keySelectRow(uid, `token_delsel:${uid}`, 'Escolha a chave para EXCLUIR');
                    return row
                        ? await promptScreen(interaction, '🗑️ Qual chave remover? (também será desvinculada dos servidores)', row)
                        : await promptScreen(interaction, '⚠️ Você não tem chaves para deletar.', backRow(uid));
                }

                case 'token_assign': {
                    const row = await keySelectRow(uid, `token_asgsel:${uid}`, 'Escolha a chave');
                    return row
                        ? await promptScreen(interaction, '🔗 Qual chave você quer vincular a um servidor?', row)
                        : await promptScreen(interaction, '⚠️ Adicione uma chave primeiro.', backRow(uid));
                }

                case 'token_test': {
                    const row = await keySelectRow(uid, `token_tstsel:${uid}`, 'Escolha a chave para testar');
                    return row
                        ? await promptScreen(interaction, '🧪 Qual chave você quer testar?', row)
                        : await promptScreen(interaction, '⚠️ Você não tem chaves para testar.', backRow(uid));
                }

                case 'token_unassign': {
                    const ud = await TokenModel.findOne({ userId: uid });
                    const assignments = ud?.assignments ?? [];
                    if (assignments.length === 0) {
                        return await promptScreen(interaction, '⚠️ Você não tem nenhum servidor vinculado.', backRow(uid));
                    }
                    const options = assignments.slice(0, 25).map(a => {
                        const g = interaction.client.guilds.cache.get(a.guildId);
                        return { label: (g ? g.name : a.guildId).slice(0, 100), value: a.guildId };
                    });
                    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        new StringSelectMenuBuilder().setCustomId(`token_unasgsel:${uid}`).setPlaceholder('Servidor para desvincular').addOptions(options),
                    );
                    return await promptScreen(interaction, '✂️ De qual servidor remover sua chave?', row);
                }
            }
        }

        // ════ SELECTS ═════════════════════════════════════════════════════════
        if (interaction.isStringSelectMenu()) {
            const value = interaction.values[0];

            switch (action) {
                case 'token_rensel': {
                    const modal = new ModalBuilder().setCustomId(`token_renmod:${value}:${uid}`).setTitle('Renomear chave');
                    const input = new TextInputBuilder().setCustomId('name').setLabel('Novo nome')
                        .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60);
                    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
                    return await interaction.showModal(modal);
                }

                case 'token_modsel': {
                    const ud = await TokenModel.findOne({ userId: uid });
                    const key = ud?.keys.find(k => k.id === value);
                    if (!key) return await backToDashboard(interaction, uid, '❌ Chave não encontrada.');
                    await interaction.update({ content: '🔎 Buscando modelos...', embeds: [], components: [] });
                    const models = await fetchModels(key.provider, key.value);
                    if (models.length === 0) {
                        return await interaction.message.edit({ content: '❌ Não consegui listar modelos (chave inválida?).', components: [backRow(uid)] });
                    }
                    const options = models.slice(0, 25).map(m => ({ label: m.slice(0, 100), value: m.slice(0, 100) }));
                    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        new StringSelectMenuBuilder().setCustomId(`token_modset:${value}:${uid}`).setPlaceholder('Novo modelo').addOptions(options),
                    );
                    return await interaction.message.edit({ content: `🧠 Escolha o novo modelo para **${key.name || key.id}**:`, components: [row] });
                }

                case 'token_modset': {
                    const keyId = parts[1];
                    await TokenModel.updateOne({ userId: uid, 'keys.id': keyId }, { $set: { 'keys.$.model': value } });
                    return await backToDashboard(interaction, uid, `✅ Modelo atualizado para \`${value}\`.`);
                }

                case 'token_delsel': {
                    await TokenModel.updateOne({ userId: uid }, { $pull: { keys: { id: value }, assignments: { keyId: value } } });
                    return await backToDashboard(interaction, uid, '🗑️ Chave removida (e desvinculada dos servidores).');
                }

                case 'token_asgsel': {
                    const mutual = await getMutualGuilds(uid, interaction.client);
                    if (mutual.length === 0) {
                        return await promptScreen(interaction, '⚠️ Não temos nenhum servidor em comum.', backRow(uid));
                    }
                    const options = mutual.slice(0, 25).map(g => ({ label: g.name.slice(0, 100), value: g.id }));
                    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        new StringSelectMenuBuilder().setCustomId(`token_asgto:${value}:${uid}`).setPlaceholder('Servidor para usar esta chave').addOptions(options),
                    );
                    return await promptScreen(interaction, '🔗 Em qual servidor usar essa chave?', row);
                }

                case 'token_asgto': {
                    const keyId = parts[1];
                    await TokenModel.updateOne({ userId: uid }, { $pull: { assignments: { guildId: value } } });
                    await TokenModel.updateOne({ userId: uid }, { $push: { assignments: { guildId: value, keyId } } });
                    return await backToDashboard(interaction, uid, '✅ Chave vinculada ao servidor!');
                }

                case 'token_unasgsel': {
                    await TokenModel.updateOne({ userId: uid }, { $pull: { assignments: { guildId: value } } });
                    return await backToDashboard(interaction, uid, '✂️ Vínculo removido.');
                }

                case 'token_tstsel': {
                    const ud = await TokenModel.findOne({ userId: uid });
                    const key = ud?.keys.find(k => k.id === value);
                    if (!key) return await backToDashboard(interaction, uid, '❌ Chave não encontrada.');
                    await interaction.update({ content: `🧪 Testando **${key.name || key.id}**...`, embeds: [], components: [] });
                    let result: string;
                    try {
                        const r = await api.generateRaw('Responda apenas com a palavra: ok', { provider: key.provider, key: key.value, model: key.model });
                        result = `✅ **${key.name || key.id}** está funcionando!\n> Resposta do modelo: \`${(r || '').trim().slice(0, 100)}\``;
                    } catch (e: any) {
                        result = `❌ **${key.name || key.id}** falhou no teste.\n> Erro: \`${(e?.message || String(e)).slice(0, 200)}\``;
                    }
                    return await interaction.message.edit({ content: result, embeds: [], components: [backRow(uid)] });
                }
            }
        }

        // ════ MODAIS ══════════════════════════════════════════════════════════
        if (interaction.isModalSubmit()) {
            if (action === 'token_addmod') {
                const name = interaction.fields.getTextInputValue('name').trim();
                const key = interaction.fields.getTextInputValue('key').trim();
                const provider = key.startsWith('AIza') ? 'gemini' : key.startsWith('sk-') ? 'openai' : null;

                if (!provider) {
                    return await backToDashboard(interaction, uid, '⚠️ Chave não reconhecida. Use uma do Google (`AIza…`) ou OpenAI (`sk-…`).');
                }

                await interaction.update({ content: `🔎 Validando a chave **${provider.toUpperCase()}**...`, embeds: [], components: [] });
                const models = await fetchModels(provider, key);
                if (models.length === 0) {
                    return await interaction.message.edit({ content: '❌ Chave inválida ou bloqueada — não consegui listar modelos com ela.', components: [backRow(uid)] });
                }

                const keyId = Date.now().toString(36);
                const keyName = name || `Chave ${provider === 'gemini' ? 'Gemini' : 'GPT'} ${keyId.slice(-4).toUpperCase()}`;
                await TokenModel.updateOne(
                    { userId: uid },
                    { $push: { keys: { id: keyId, name: keyName, provider, value: key, model: models[0] } } },
                );

                const options = models.slice(0, 25).map(m => ({ label: m.slice(0, 100), value: m.slice(0, 100) }));
                const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    new StringSelectMenuBuilder().setCustomId(`token_modset:${keyId}:${uid}`).setPlaceholder('Escolha o modelo desta chave').addOptions(options),
                );
                return await interaction.message.edit({ content: `✅ Chave **${keyName}** adicionada! Agora escolha o modelo:`, components: [row] });
            }

            if (action === 'token_renmod') {
                const keyId = parts[1];
                const name = interaction.fields.getTextInputValue('name').trim();
                await TokenModel.updateOne({ userId: uid, 'keys.id': keyId }, { $set: { 'keys.$.name': name } });
                return await backToDashboard(interaction, uid, `✅ Renomeada para **${name}**.`);
            }
        }
    } catch (e) {
        console.error('[Token] Erro na interação:', e);
        if (interaction.isRepliable?.() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '🚨 Erro ao processar a ação. Tente de novo com `rp!token`.' }).catch(() => {});
        }
    }
}
