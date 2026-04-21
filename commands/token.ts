import { 
    Message, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, 
    ButtonBuilder, ButtonStyle, ComponentType 
} from 'discord.js';
import { TokenModel } from '../tools/models/TokenSchema';

export default {
    name: 'token',
    description: 'Gerencia suas chaves de API (Gemini/OpenAI) no banco de dados.',

    async execute(message: Message, args: string[]) {
        const isDM = !message.guild;
        const userId = message.author.id;

        let userData = await TokenModel.findOne({ userId });
        if (!userData) {
            userData = await TokenModel.create({ userId, keys: [], assignments: [] });
        }

        if (!isDM) {
            await message.reply("📩 **Foquei na segurança!** Te mandei o painel de gerenciamento de chaves no seu PV.");
        }

        try {
            const dm = await message.author.createDM();
            await this.renderDashboard(dm, userId, message.client);
        } catch (e) {
            if (!isDM) await message.reply("❌ Não consegui enviar DM. Verifique se seu PV está aberto para receber mensagens.");
            console.error(e);
        }
    },

    async renderDashboard(dmChannel: any, userId: string, client: any, existingMessage: Message | null = null) {
        const userData = await TokenModel.findOne({ userId });
        if (!userData) return;

        const keysList = userData.keys.length > 0 
            ? userData.keys.map(k => `🔑 **${k.name}** (${k.provider}) - Modelo: \`${k.model}\``).join('\n')
            : "Nenhuma chave cadastrada ainda.";

        const mutualGuilds = [];
        for (const guild of client.guilds.cache.values()) {
            let isMember = guild.members.cache.has(userId);
            if (!isMember) {
                try {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member) isMember = true;
                } catch (e) {}
            }
            if (isMember) mutualGuilds.push(guild);
        }

        let assignmentsList = "";
        if (mutualGuilds.length === 0) {
            assignmentsList = "Não encontrei nenhum servidor em comum entre nós.";
        } else {
            assignmentsList = mutualGuilds.map(guild => {
                const assignment = userData.assignments.find((a: any) => a.guildId === guild.id);
                if (assignment) {
                    const key = userData.keys.find((k: any) => k.id === assignment.keyId);
                    const keyName = key ? key.name : "Chave inválida";
                    return `✅ **${guild.name}** ➔ Usa a chave: \`${keyName}\``;
                } else {
                    return `❌ **${guild.name}**`;
                }
            }).join('\n');
        }

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Painel de Controle de IA (RPTool)')
            .setDescription('Gerencie as chaves que dão vida aos comandos do bot nos seus servidores. **Nunca compartilhe essas chaves com ninguém!**\n\n')
            .addFields(
                { name: 'Suas Chaves Salvas', value: keysList, inline: false },
                { name: 'Servidores Vinculados', value: assignmentsList, inline: false }
            )
            .setColor('#2b2d31')
            .setFooter({ text: 'Selecione uma ação no menu abaixo.' });

        const actionMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('token_crud_action')
                .setPlaceholder('Escolha uma ação...')
                .addOptions([
                    { label: 'Adicionar nova chave', value: 'add_key', emoji: '➕' },
                    { label: 'Deletar uma chave', value: 'delete_key', emoji: '🗑️' },
                    { label: 'Renomear uma chave', value: 'rename_key', emoji: '✏️' }, 
                    { label: 'Vincular chave a um servidor', value: 'assign_server', emoji: '🔗' },
                    { label: 'Desvincular de um servidor', value: 'unassign_server', emoji: '✂️' },
                    { label: 'Atualizar Painel', value: 'refresh', emoji: '🔄' }
                ])
        );

        let dashMessage;
        if (existingMessage) {
            dashMessage = await existingMessage.edit({ embeds: [embed], components: [actionMenu] });
        } else {
            dashMessage = await dmChannel.send({ embeds: [embed], components: [actionMenu] });
        }

        this.handleDashboardInteractions(dashMessage, userId, client);
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

    async flowAddKey(dmChannel: any, userId: string, client: any, dashMessage: Message) {
        const askMsg = await dmChannel.send("📝 **Envie sua nova API Key aqui no chat** (Começando com `AIza...` para Gemini ou `sk-...` para OpenAI):");
        
        const collector = dmChannel.createMessageCollector({ max: 1, time: 60000 });
        
        collector.on('collect', async (m: Message) => {
            const key = m.content.trim();
            let provider: 'gemini' | 'openai' | null = null;
            if (key.startsWith('AIza')) provider = 'gemini';
            else if (key.startsWith('sk-')) provider = 'openai';

            if (!provider) {
                await dmChannel.send("⚠️ Token não reconhecido. Cancelando operação.");
                return this.renderDashboard(dmChannel, userId, client, dashMessage);
            }

            const statusMsg = await dmChannel.send(`🔎 Detectei provedor **${provider.toUpperCase()}**. Buscando modelos...`);
            const models = await this.fetchModels(provider, key);
            
            if (models.length === 0) {
                await statusMsg.edit("❌ Chave inválida ou bloqueada. Cancelando.");
                return this.renderDashboard(dmChannel, userId, client, dashMessage);
            }

            const options = models.slice(0, 25).map((mod: string) => ({ label: mod, value: mod }));
            const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(new StringSelectMenuBuilder().setCustomId('select_model').setPlaceholder('Selecione o Modelo da IA').addOptions(options));

            await statusMsg.edit({ content: "📋 **Escolha qual modelo esta chave vai usar:**", components: [row] });
            
            try {
                const selection = await statusMsg.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
                const selectedModel = selection.values[0];
                const keyId = Date.now().toString(36);
                const keyName = `Chave ${provider === 'gemini' ? 'Gemini' : 'GPT'} ${keyId.substring(0,4).toUpperCase()}`;

                await TokenModel.updateOne(
                    { userId },
                    { $push: { keys: { id: keyId, name: keyName, provider, value: key, model: selectedModel } } }
                );

                await selection.update({ content: `✅ Nova chave salva como **${keyName}**! Atualizando painel...`, components: [] });
                setTimeout(() => this.renderDashboard(dmChannel, userId, client, dashMessage), 2000);
            } catch (e) {
                await statusMsg.edit({ content: "⏱️ Tempo esgotado para escolher o modelo.", components: [] });
                this.renderDashboard(dmChannel, userId, client, dashMessage);
            }
        });
    },

    async flowDeleteKey(dmChannel: any, userId: string, client: any, dashMessage: Message) {
        const userData = await TokenModel.findOne({ userId });
        if (!userData || userData.keys.length === 0) {
            const msg = await dmChannel.send("⚠️ Você não tem nenhuma chave para deletar.");
            setTimeout(() => { msg.delete().catch(()=>{}); this.renderDashboard(dmChannel, userId, client, dashMessage); }, 3000);
            return;
        }

        const options = userData.keys.map(k => ({
            label: k.name,
            description: `Modelo: ${k.model}`,
            value: k.id
        }));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(new StringSelectMenuBuilder().setCustomId('delete_select').setPlaceholder('Selecione a chave para EXCLUIR').addOptions(options));

        const msg = await dmChannel.send({ content: "🗑️ **Qual chave você quer remover?** (Ela também será desvinculada dos servidores)", components: [row] });

        try {
            const selection = await msg.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
            const keyIdToDelete = selection.values[0];

            await TokenModel.updateOne(
                { userId },
                { $pull: { keys: { id: keyIdToDelete }, assignments: { keyId: keyIdToDelete } } }
            );

            await selection.update({ content: "✅ Chave removida com sucesso! Atualizando painel...", components: [] });
            setTimeout(() => this.renderDashboard(dmChannel, userId, client, dashMessage), 2000);
        } catch (e) {
            await msg.edit({ content: "⏱️ Operação cancelada por inatividade.", components: [] });
            this.renderDashboard(dmChannel, userId, client, dashMessage);
        }
    },

    async flowAssignServer(dmChannel: any, userId: string, client: any, dashMessage: Message) {
        const userData = await TokenModel.findOne({ userId });
        if (!userData || userData.keys.length === 0) {
            const msg = await dmChannel.send("⚠️ Adicione pelo menos uma chave primeiro.");
            setTimeout(() => { msg.delete().catch(()=>{}); }, 3000);
            return;
        }

        const keyOptions = userData.keys.map(k => ({ label: k.name, description: `Modelo: ${k.model}`, value: k.id }));
        const keyRow = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(new StringSelectMenuBuilder().setCustomId('assign_key_select').setPlaceholder('Selecione a chave').addOptions(keyOptions));

        const msgKey = await dmChannel.send({ content: "🔗 **Qual chave você quer vincular a um servidor?**", components: [keyRow] });

        try {
            const selection = await msgKey.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
            const selectedKeyId = selection.values[0];
            await selection.update({ content: "✅ Chave selecionada! Agora, **digite no chat o ID do servidor** onde quer usá-la:", components: [] });

            const filter = (m: Message) => m.author.id === userId && /^\d{17,19}$/.test(m.content.trim());
            const collector = dmChannel.createMessageCollector({ filter, max: 1, time: 60000 });

            collector.on('collect', async (m: Message) => {
                const guildId = m.content.trim();
                const guild = client.guilds.cache.get(guildId);
                
                if (!guild) {
                    await dmChannel.send("❌ Não estou nesse servidor ou o ID é inválido.");
                    return this.renderDashboard(dmChannel, userId, client, dashMessage);
                }

                await TokenModel.updateOne({ userId }, { $pull: { assignments: { guildId } } });
                await TokenModel.updateOne({ userId }, { $push: { assignments: { guildId, keyId: selectedKeyId } } });

                await dmChannel.send(`✅ Sucesso! A chave agora está vinculada ao servidor **${guild.name}**.`);
                setTimeout(() => this.renderDashboard(dmChannel, userId, client, dashMessage), 2000);
            });
        } catch (e) {
            await msgKey.edit({ content: "⏱️ Operação cancelada por inatividade.", components: [] });
            this.renderDashboard(dmChannel, userId, client, dashMessage);
        }
    },

    async flowUnassignServer(dmChannel: any, userId: string, client: any, dashMessage: Message) {
        const userData = await TokenModel.findOne({ userId });
        if (!userData || userData.assignments.length === 0) {
            const msg = await dmChannel.send("⚠️ Você não tem nenhum servidor vinculado.");
            setTimeout(() => { msg.delete().catch(()=>{}); }, 3000);
            return;
        }

        const options = userData.assignments.slice(0, 25).map(a => {
            const guild = client.guilds.cache.get(a.guildId);
            return { label: guild ? guild.name : `ID: ${a.guildId}`, value: a.guildId };
        });

        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(new StringSelectMenuBuilder().setCustomId('unassign_select').setPlaceholder('Selecione o servidor').addOptions(options));

        const msg = await dmChannel.send({ content: "✂️ **De qual servidor você quer remover sua chave?**", components: [row] });

        try {
            const selection = await msg.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
            const guildIdToRemove = selection.values[0];

            await TokenModel.updateOne({ userId }, { $pull: { assignments: { guildId: guildIdToRemove } } });

            await selection.update({ content: "✅ Vínculo removido com sucesso!", components: [] });
            setTimeout(() => this.renderDashboard(dmChannel, userId, client, dashMessage), 2000);
        } catch (e) {
            await msg.edit({ content: "⏱️ Operação cancelada.", components: [] });
            this.renderDashboard(dmChannel, userId, client, dashMessage);
        }
    },

    async flowRenameKey(dmChannel: any, userId: string, client: any, dashMessage: Message) {
        const userData = await TokenModel.findOne({ userId });
        if (!userData || userData.keys.length === 0) {
            const msg = await dmChannel.send("⚠️ Você não tem chaves para renomear.");
            setTimeout(() => { msg.delete().catch(()=>{}); }, 3000);
            return;
        }

        const options = userData.keys.map((k: any) => ({
            label: k.name,
            description: `Modelo: ${k.model}`,
            value: k.id
        }));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(new StringSelectMenuBuilder().setCustomId('rename_select').setPlaceholder('Selecione a chave para renomear').addOptions(options));

        const msg = await dmChannel.send({ content: "✏️ **Qual chave você quer renomear?**", components: [row] });

        try {
            const selection = await msg.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
            const keyIdToRename = selection.values[0];
            const selectedKey = userData.keys.find((k: any) => k.id === keyIdToRename);

            await selection.update({ 
                content: `✅ Você selecionou **${selectedKey?.name}**. \n\n💬 **Digite o novo nome no chat** (ou digite \`deletar\` para remover o nome personalizado):`, 
                components: [] 
            });

            const filter = (m: Message) => m.author.id === userId;
            const collector = dmChannel.createMessageCollector({ filter, max: 1, time: 60000 });

            collector.on('collect', async (m: Message) => {
                let newName = m.content.trim();
                
                if (newName.toLowerCase() === 'deletar') {
                    newName = `Chave ${selectedKey?.provider === 'gemini' ? 'Gemini' : 'GPT'} ${selectedKey?.id.substring(0,4).toUpperCase()}`;
                }

                await TokenModel.updateOne(
                    { userId, "keys.id": keyIdToRename },
                    { $set: { "keys.$.name": newName } }
                );

                await dmChannel.send(`✅ O nome da chave foi atualizado para **${newName}**!`);
                setTimeout(() => this.renderDashboard(dmChannel, userId, client, dashMessage), 2000);
            });

        } catch (e) {
            await msg.edit({ content: "⏱️ Operação cancelada por inatividade.", components: [] });
            this.renderDashboard(dmChannel, userId, client, dashMessage);
        }
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
    },

    handleDashboardInteractions(dashMessage: Message, userId: string, client: any) {
        const filter = (interaction: any) => interaction.user.id === userId;
        
        const collector = dashMessage.createMessageComponentCollector({ filter, time: 600000 });

        collector.on('collect', async (interaction) => {
            if (!interaction.isStringSelectMenu()) return;
            
            const action = interaction.values[0];
            await interaction.deferUpdate();

            switch (action) {
                case 'add_key':
                    await interaction.followUp({ content: 'Iniciando processo...', ephemeral: true });
                    await this.flowAddKey(interaction.message.channel, userId, client, dashMessage);
                    break;

                case 'delete_key':
                    await interaction.followUp({ content: 'Abrindo exclusão...', ephemeral: true });
                    await this.flowDeleteKey(interaction.message.channel, userId, client, dashMessage);
                    break;

                case 'assign_server':
                    await interaction.followUp({ content: 'Preparando vínculo...', ephemeral: true });
                    await this.flowAssignServer(interaction.message.channel, userId, client, dashMessage);
                    break;

                case 'unassign_server':
                    await interaction.followUp({ content: 'Preparando desvinculação...', ephemeral: true });
                    await this.flowUnassignServer(interaction.message.channel, userId, client, dashMessage);
                    break;

                case 'refresh':
                    await this.renderDashboard(interaction.message.channel, userId, client, dashMessage);
                    break;

                case 'rename_key':
                    await interaction.followUp({ content: 'Preparando renomeação...', ephemeral: true });
                    await this.flowRenameKey(interaction.message.channel, userId, client, dashMessage);
                    break;
            }
        });

        collector.on('end', () => {
            dashMessage.edit({ components: [] }).catch(() => {});
        });
    },

};