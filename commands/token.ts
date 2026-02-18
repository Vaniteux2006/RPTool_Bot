import { Message, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { TokenModel } from '../models/TokenSchema';

export default {
    name: 'token',
    description: 'Gerencia suas chaves de API (Gemini/OpenAI) no banco de dados.',

    async execute(message: Message, args: string[]) {
        const guildId = message.guild?.id;
        const guildName = message.guild?.name || "DM";

        if (!guildId) {
            return message.reply("⚠️ Para eu saber qual servidor configurar, você precisa usar este comando **dentro do servidor**!");
        }

        let userData = await TokenModel.findOne({ userId: message.author.id });
        if (!userData) {
            userData = await TokenModel.create({ userId: message.author.id, keys: [], assignments: [] });
        }

        message.reply("📩 **Verifique seu PV!** Te mandei o painel de chaves para este servidor.");

        try {
            const dm = await message.author.createDM();
            await this.sendDashboard(dm, message.author.id, guildId, guildName);
        } catch (e) {
            message.reply("❌ Não consegui enviar DM. Verifique se seu PV está aberto.");
        }
    },

    async sendDashboard(dm: any, userId: string, guildId: string, guildName: string) {
        const userData = await TokenModel.findOne({ userId });
        const keys = userData?.keys || [];

        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Configuração de IA: ${guildName}`)
            .setColor(0x00FF00)
            .setDescription("Selecione qual das suas chaves você quer ativar neste servidor ou adicione uma nova ao seu chaveiro.");

        const options = keys.map((k: any) => ({
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

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_key')
            .setPlaceholder('Selecione uma chave da lista...')
            .addOptions(options);

        const saveButton = new ButtonBuilder()
            .setCustomId('save_key')
            .setLabel('Salvar Configuração')
            .setStyle(ButtonStyle.Success); 

        const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(saveButton);

        const msg = await dm.send({ embeds: [embed], components: [row1, row2] });

        const collector = msg.createMessageComponentCollector({ time: 120000 });

        let selectedKey = "";

        collector.on('collect', async (i: any) => {
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
                if (!selectedKey) return i.reply({ content: "⚠️ Você esqueceu de escolher uma opção na listinha primeiro!", ephemeral: true });
                
                if (selectedKey === "remove") {
                    await TokenModel.updateOne({ userId }, { $pull: { assignments: { guildId } } });
                    await i.update({ content: `✅ IA **desativada** para o servidor **${guildName}**.`, embeds: [], components: [] });
                    return;
                }

                await TokenModel.updateOne({ userId }, { $pull: { assignments: { guildId } } });
                await TokenModel.updateOne({ userId }, { $push: { assignments: { guildId, keyId: selectedKey } } });

                const chosenKey = keys.find((k: any) => k.id === selectedKey);
                await i.update({ content: `✅ **SUCESSO!** O servidor **${guildName}** agora usará a chave **${chosenKey.name}** (${chosenKey.model}).`, embeds: [], components: [] });
            }
        });
    },

    async awaitNewKey(dm: any, userId: string, guildId: string, guildName: string) {
        const collector = dm.createMessageCollector({ max: 1, time: 60000 });
        collector.on('collect', async (m: Message) => {
            const key = m.content.trim();
            let provider: 'gemini' | 'openai' | null = null;
            if (key.startsWith('AIza')) provider = 'gemini';
            else if (key.startsWith('sk-')) provider = 'openai';

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

            const options = models.slice(0, 25).map((mod: string) => ({ label: mod, value: mod }));

            const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(new StringSelectMenuBuilder().setCustomId('select_model').setPlaceholder('Selecione o Modelo da IA').addOptions(options));

            const selectMsg = await dm.send({ content: "📋 **Escolha qual modelo esta chave vai usar:**", components: [row] });
            
            try {
                const selection = await selectMsg.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
                const selectedModel = selection.values[0];
                const keyId = Date.now().toString(36);
                const keyName = `Chave ${provider === 'gemini' ? 'Gemini' : 'GPT'} ${keyId.substring(0,4).toUpperCase()}`;

                await TokenModel.updateOne(
                    { userId },
                    { $push: { keys: { id: keyId, name: keyName, provider, value: key, model: selectedModel } } }
                );

                await selection.update({ content: `✅ Nova chave adicionada ao chaveiro como **${keyName}**! Te enviando o painel novamente...`, components: [] });
                setTimeout(() => this.sendDashboard(dm, userId, guildId, guildName), 2000);
            } catch (e) {
                await dm.send("⏱️ Você demorou muito para escolher o modelo.");
            }
        });
    },

    async fetchModels(provider: 'gemini' | 'openai', key: string): Promise<string[]> {
        try {
            if (provider === 'gemini') {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                const data = await res.json();
                if (!data.models) return [];
                return data.models.filter((m: any) => m.supportedGenerationMethods.includes("generateContent")).map((m: any) => m.name.replace('models/', ''));
            } 
            else if (provider === 'openai') {
                const res = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
                const data = await res.json();
                if (!data.data) return [];
                return data.data.filter((m: any) => m.id.includes('gpt')).map((m: any) => m.id);
            }
            return [];
        } catch (e) { return []; }
    }
};