"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const TokenSchema_1 = require("../models/TokenSchema");
exports.default = {
    name: 'token',
    description: 'Gerencia suas chaves de API (Gemini/OpenAI) no banco de dados.',
    async execute(message, args) {
        const guildId = message.guild?.id;
        const guildName = message.guild?.name || "DM";
        if (!guildId) {
            return message.reply("⚠️ Para eu saber qual servidor configurar, você precisa usar este comando **dentro do servidor**!");
        }
        let userData = await TokenSchema_1.TokenModel.findOne({ userId: message.author.id });
        if (!userData) {
            userData = await TokenSchema_1.TokenModel.create({ userId: message.author.id, keys: [], assignments: [] });
        }
        message.reply("📩 **Verifique seu PV!** Te mandei o painel de chaves para este servidor.");
        try {
            const dm = await message.author.createDM();
            await this.sendDashboard(dm, message.author.id, guildId, guildName);
        }
        catch (e) {
            message.reply("❌ Não consegui enviar DM. Verifique se seu PV está aberto.");
        }
    },
    async sendDashboard(dm, userId, guildId, guildName) {
        const userData = await TokenSchema_1.TokenModel.findOne({ userId });
        const keys = userData?.keys || [];
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`⚙️ Configuração de IA: ${guildName}`)
            .setColor(0x00FF00)
            .setDescription("Selecione qual das suas chaves você quer ativar neste servidor ou adicione uma nova ao seu chaveiro.");
        const options = keys.map((k) => ({
            label: `${k.name} (${k.provider.toUpperCase()})`,
            description: `Modelo: ${k.model}`,
            value: k.id
        }));
        options.push({
            label: "➕ Adicionar Nova Chave",
            description: "Salva um novo token Gemini ou OpenAI no seu chaveiro",
            value: "add_new"
        });
        options.push({
            label: "❌ Desativar IA",
            description: "Remove sua chave deste servidor",
            value: "remove"
        });
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId('select_key')
            .setPlaceholder('Selecione uma chave da lista...')
            .addOptions(options);
        const saveButton = new discord_js_1.ButtonBuilder()
            .setCustomId('save_key')
            .setLabel('Salvar Configuração')
            .setStyle(discord_js_1.ButtonStyle.Success);
        const row1 = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        const row2 = new discord_js_1.ActionRowBuilder().addComponents(saveButton);
        const msg = await dm.send({ embeds: [embed], components: [row1, row2] });
        const collector = msg.createMessageComponentCollector({ time: 120000 });
        let selectedKey = "";
        collector.on('collect', async (i) => {
            if (i.isStringSelectMenu()) {
                selectedKey = i.values[0];
                if (selectedKey === "add_new") {
                    await i.reply({ content: "📝 **Envie sua nova API Key aqui no chat** (Começando com `AIza...` ou `sk-...`):", ephemeral: true });
                    this.awaitNewKey(dm, userId, guildId, guildName);
                    collector.stop();
                    return;
                }
                await i.deferUpdate();
            }
            if (i.isButton() && i.customId === 'save_key') {
                if (!selectedKey)
                    return i.reply({ content: "⚠️ Você esqueceu de escolher uma opção na listinha primeiro!", ephemeral: true });
                if (selectedKey === "remove") {
                    await TokenSchema_1.TokenModel.updateOne({ userId }, { $pull: { assignments: { guildId } } });
                    await i.update({ content: `✅ IA **desativada** para o servidor **${guildName}**.`, embeds: [], components: [] });
                    return;
                }
                await TokenSchema_1.TokenModel.updateOne({ userId }, { $pull: { assignments: { guildId } } });
                await TokenSchema_1.TokenModel.updateOne({ userId }, { $push: { assignments: { guildId, keyId: selectedKey } } });
                const chosenKey = keys.find((k) => k.id === selectedKey);
                await i.update({ content: `✅ **SUCESSO!** O servidor **${guildName}** agora usará a chave **${chosenKey.name}** (${chosenKey.model}).`, embeds: [], components: [] });
            }
        });
    },
    async awaitNewKey(dm, userId, guildId, guildName) {
        const collector = dm.createMessageCollector({ max: 1, time: 60000 });
        collector.on('collect', async (m) => {
            const key = m.content.trim();
            let provider = null;
            if (key.startsWith('AIza'))
                provider = 'gemini';
            else if (key.startsWith('sk-'))
                provider = 'openai';
            if (!provider) {
                await dm.send("⚠️ Token não reconhecido. Use uma chave do Google ou OpenAI.");
                return this.sendDashboard(dm, userId, guildId, guildName);
            }
            await dm.send(`🔎 Detectei provedor **${provider.toUpperCase()}**. Buscando modelos...`);
            const models = await this.fetchModels(provider, key);
            if (models.length === 0) {
                await dm.send("❌ Chave inválida ou bloqueada.");
                return this.sendDashboard(dm, userId, guildId, guildName);
            }
            const options = models.slice(0, 25).map((mod) => ({ label: mod, value: mod }));
            const row = new discord_js_1.ActionRowBuilder()
                .addComponents(new discord_js_1.StringSelectMenuBuilder().setCustomId('select_model').setPlaceholder('Selecione o Modelo da IA').addOptions(options));
            const selectMsg = await dm.send({ content: "📋 **Escolha qual modelo esta chave vai usar:**", components: [row] });
            try {
                const selection = await selectMsg.awaitMessageComponent({ componentType: discord_js_1.ComponentType.StringSelect, time: 60000 });
                const selectedModel = selection.values[0];
                const keyId = Date.now().toString(36);
                const keyName = `Chave ${provider === 'gemini' ? 'Gemini' : 'GPT'} ${keyId.substring(0, 4).toUpperCase()}`;
                await TokenSchema_1.TokenModel.updateOne({ userId }, { $push: { keys: { id: keyId, name: keyName, provider, value: key, model: selectedModel } } });
                await selection.update({ content: `✅ Nova chave adicionada ao chaveiro como **${keyName}**! Te enviando o painel novamente...`, components: [] });
                setTimeout(() => this.sendDashboard(dm, userId, guildId, guildName), 2000);
            }
            catch (e) {
                await dm.send("⏱️ Você demorou muito para escolher o modelo.");
            }
        });
    },
    async fetchModels(provider, key) {
        try {
            if (provider === 'gemini') {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                const data = await res.json();
                if (!data.models)
                    return [];
                return data.models.filter((m) => m.supportedGenerationMethods.includes("generateContent")).map((m) => m.name.replace('models/', ''));
            }
            else if (provider === 'openai') {
                const res = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
                const data = await res.json();
                if (!data.data)
                    return [];
                return data.data.filter((m) => m.id.includes('gpt')).map((m) => m.id);
            }
            return [];
        }
        catch (e) {
            return [];
        }
    }
};
