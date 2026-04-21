import { Message, EmbedBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { Command } from '../tools/interfaces/Command';
// 👇 Importando os Models novinhos em folha! (Verifique se o caminho da pasta bate com o seu)
import { KanbanItemModel, KanbanPainelModel } from '../tools/models/KanbanSchema';

// ---------------------------------------------------------
// FUNÇÕES AUXILIARES
// ---------------------------------------------------------
async function buildKanbanEmbed(guildId: string) {
    const tasks = await KanbanItemModel.find({ guildId: guildId });

    const todoTasks = tasks.filter(t => t.status === 'TODO').map(t => `\`#${t.shortId}\` ${t.title} (<@${t.userId}>)`).join('\n') || '*Vazio*';
    const doingTasks = tasks.filter(t => t.status === 'DOING').map(t => `\`#${t.shortId}\` ${t.title} (<@${t.userId}>)`).join('\n') || '*Vazio*';
    const doneTasks = tasks.filter(t => t.status === 'DONE').map(t => `\`#${t.shortId}\` ${t.title} (<@${t.userId}>)`).join('\n') || '*Vazio*';

    return new EmbedBuilder()
        .setTitle('📋 Quadro Kanban Fixo')
        .setDescription('Atualizado em tempo real!')
        .setColor('#2F3136')
        .addFields(
            { name: '🔴 A Fazer (TODO)', value: todoTasks, inline: false },
            { name: '🟡 Fazendo (DOING)', value: doingTasks, inline: false },
            { name: '🟢 Concluído (DONE)', value: doneTasks, inline: false }
        )
        .setTimestamp();
}

async function refreshLiveBoard(guildId: string, client: any) {
    const boardData = await KanbanPainelModel.findOne({ guildId });
    if (!boardData) return;

    try {
        const channel = await client.channels.fetch(boardData.channelId) as TextChannel;
        if (!channel) return;

        const message = await channel.messages.fetch(boardData.messageId);
        if (!message) return;

        const updatedEmbed = await buildKanbanEmbed(guildId);
        await message.edit({ embeds: [updatedEmbed] });
    } catch (error) {
        console.log('Painel do Kanban apagado à mão, deletando do registro.');
        await KanbanPainelModel.deleteOne({ guildId });
    }
}

// ---------------------------------------------------------
// COMANDO PRINCIPAL
// ---------------------------------------------------------
export const command: Command = {
    name: "kanban",
    description: "Gerencia suas tarefas de desenvolvimento do bot",
    aliases: ["kb", "tasks"],
    execute: async (event: Message | ChatInputCommandInteraction | any, args: string[]) => {
        
        const isMessage = !!event.content;
        const guildId = event.guildId;
        const userId = isMessage ? event.author.id : event.user?.id;
        const client = event.client;

        if (!guildId) {
            return isMessage ? event.reply('❌ Comando restrito a servidores.') : event.reply({ content: '❌ Restrito a servidores.', ephemeral: true });
        }

        const subCommand = args[0]?.toLowerCase();

        if (!subCommand || subCommand === 'help' || subCommand === 'ajuda') {
            const helpEmbed = new EmbedBuilder()
                .setTitle('🛠️ Central do Kanban')
                .setColor('#0099ff')
                .setDescription('Gerencie suas tarefas direto do Discord.')
                .addFields(
                    { name: '➕ Adicionar', value: '`rp!kanban add [TODO|DOING|DONE] [Tarefa]`' },
                    { name: '➡️ Mover', value: '`rp!kanban move [ID] [NOVO_STATUS]`' },
                    { name: '❌ Deletar', value: '`rp!kanban del [ID]`' },
                    { name: '📺 Criar Painel', value: '`rp!kanban show #canal`' },
                    { name: '👀 Ver Rápido', value: '`rp!kanban ver`' }
                );
            return isMessage ? event.reply({ embeds: [helpEmbed] }) : event.reply({ embeds: [helpEmbed], ephemeral: true });
        }

        try {
            if (subCommand === 'add') {
                const status = args[1]?.toUpperCase(); 
                const title = args.slice(2).join(' '); 

                if (!['TODO', 'DOING', 'DONE'].includes(status) || !title) {
                    return event.reply('❌ Uso: `rp!kanban add [TODO|DOING|DONE] [Tarefa]`');
                }
                
                const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
                await KanbanItemModel.create({ guildId, userId, shortId, title, status });
                await refreshLiveBoard(guildId, client); 

                return event.reply(`✅ Tarefa \`#${shortId}\` salva com sucesso!`);
            }

            if (subCommand === 'move' || subCommand === 'mover') {
                const targetId = args[1]?.toUpperCase();
                const newStatus = args[2]?.toUpperCase();

                if (!targetId || !['TODO', 'DOING', 'DONE'].includes(newStatus)) {
                    return event.reply('❌ Uso: `rp!kanban move [ID] [TODO|DOING|DONE]`');
                }

                const task = await KanbanItemModel.findOneAndUpdate({ guildId, shortId: targetId }, { status: newStatus });
                if (!task) return event.reply(`❌ Tarefa \`#${targetId}\` não encontrada.`);

                await refreshLiveBoard(guildId, client); 
                return event.reply(`➡️ Tarefa \`#${targetId}\` movida para **${newStatus}**!`);
            }

            if (subCommand === 'del' || subCommand === 'deletar') {
                const targetId = args[1]?.toUpperCase();
                if (!targetId) return event.reply('❌ Uso: `rp!kanban del [ID]`');

                const result = await KanbanItemModel.deleteOne({ guildId, shortId: targetId });
                if (result.deletedCount === 0) return event.reply(`❌ Tarefa \`#${targetId}\` não encontrada.`);

                await refreshLiveBoard(guildId, client);
                return event.reply(`🗑️ Tarefa \`#${targetId}\` deletada.`);
            }

            if (subCommand === 'show' || subCommand === 'painel') {
                const targetChannel = isMessage ? event.mentions.channels.first() || event.channel : event.channel;
                if (!targetChannel) return event.reply('❌ Canal inválido.');

                const embed = await buildKanbanEmbed(guildId);
                const boardMessage = await targetChannel.send({ embeds: [embed] });

                await KanbanPainelModel.findOneAndUpdate(
                    { guildId: guildId },
                    { channelId: targetChannel.id, messageId: boardMessage.id },
                    { upsert: true, new: true }
                );

                return event.reply(`📺 Painel criado com sucesso em <#${targetChannel.id}>!`);
            }

            if (subCommand === 'ver' || subCommand === 'view') {
                const embed = await buildKanbanEmbed(guildId);
                return event.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Erro no Kanban:', error);
            return event.reply('❌ Erro de conexão com o banco de dados.');
        }
    }
};