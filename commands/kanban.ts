import { Message, EmbedBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { Schema, model, models, Document } from 'mongoose';
import { Command } from '../tools/interfaces/Command';

// ---------------------------------------------------------
// REQUISITOS DE DADOS (MongoDB)
// ---------------------------------------------------------

// 1. Tabela de Tarefas
interface IKanban extends Document {
    guildId: string;
    userId: string;
    shortId: string;
    title: string;
    status: 'TODO' | 'DOING' | 'DONE';
}
const kanbanSchema = new Schema<IKanban>({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    shortId: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, required: true, enum: ['TODO', 'DOING', 'DONE'] }
});
const KanbanModel = models.KanbanTask || model<IKanban>('KanbanTask', kanbanSchema);

// 2. Tabela do Painel Fixo (Live Board)
interface IKanbanBoard extends Document {
    guildId: string;
    channelId: string;
    messageId: string;
}
const boardSchema = new Schema<IKanbanBoard>({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true }
});
const KanbanBoardModel = models.KanbanBoard || model<IKanbanBoard>('KanbanBoard', boardSchema);

// ---------------------------------------------------------
// FUNÇÕES AUXILIARES
// ---------------------------------------------------------

// Monta o visual do Kanban (usado no 'ver' e no painel fixo)
async function buildKanbanEmbed(guildId: string) {
    const tasks = await KanbanModel.find({ guildId: guildId });

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

// Atualiza o painel fixo automaticamente, se ele existir
async function refreshLiveBoard(guildId: string, client: any) {
    const boardData = await KanbanBoardModel.findOne({ guildId });
    if (!boardData) return; // Se não tem painel configurado, ignora.

    try {
        const channel = await client.channels.fetch(boardData.channelId) as TextChannel;
        if (!channel) return;

        const message = await channel.messages.fetch(boardData.messageId);
        if (!message) return;

        const updatedEmbed = await buildKanbanEmbed(guildId);
        await message.edit({ embeds: [updatedEmbed] });
    } catch (error) {
        // Se a mensagem foi apagada à mão, limpamos do banco
        console.log('Painel do Kanban não encontrado, deletando do registro.');
        await KanbanBoardModel.deleteOne({ guildId });
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
        const client = event.client; // Pega o client pra atualizar o painel

        if (!guildId) {
            return isMessage ? event.reply('❌ Comando restrito a servidores.') : event.reply({ content: '❌ Restrito a servidores.', ephemeral: true });
        }

        const subCommand = args[0]?.toLowerCase();

        // ==========================================
        // MENU DE AJUDA (Sem argumentos)
        // ==========================================
        if (!subCommand || subCommand === 'help' || subCommand === 'ajuda') {
            const helpEmbed = new EmbedBuilder()
                .setTitle('🛠️ Central do Kanban')
                .setColor('#0099ff')
                .setDescription('Gerencie suas tarefas e requisitos direto do Discord.')
                .addFields(
                    { name: '➕ Adicionar', value: '`rp!kanban add [TODO|DOING|DONE] [Sua Tarefa]`' },
                    { name: '➡️ Mover', value: '`rp!kanban move [ID] [NOVO_STATUS]`\n*Ex: rp!kanban move A4F9 DONE*' },
                    { name: '❌ Deletar', value: '`rp!kanban del [ID]`\n*Ex: rp!kanban del A4F9*' },
                    { name: '📺 Criar Painel Fixo', value: '`rp!kanban show #canal`\n*Cria um mural que atualiza sozinho.*' },
                    { name: '👀 Ver Temporário', value: '`rp!kanban ver`\n*Mostra o quadro na mensagem atual.*' }
                );
            return isMessage ? event.reply({ embeds: [helpEmbed] }) : event.reply({ embeds: [helpEmbed], ephemeral: true });
        }

        try {
            // ==========================================
            // ADICIONAR TAREFA
            // ==========================================
            if (subCommand === 'add') {
                const status = args[1]?.toUpperCase(); 
                const title = args.slice(2).join(' '); 

                if (!['TODO', 'DOING', 'DONE'].includes(status) || !title) {
                    return event.reply('❌ Uso: `rp!kanban add [TODO|DOING|DONE] [Sua tarefa aqui]`');
                }
                
                const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
                await KanbanModel.create({ guildId, userId, shortId, title, status });
                await refreshLiveBoard(guildId, client); // <- MAGIA DO TEMPO REAL AQUI!

                return event.reply(`✅ Tarefa \`#${shortId}\` salva! O mural foi atualizado.`);
            }

            // ==========================================
            // MOVER TAREFA
            // ==========================================
            if (subCommand === 'move' || subCommand === 'mover') {
                const targetId = args[1]?.toUpperCase();
                const newStatus = args[2]?.toUpperCase();

                if (!targetId || !['TODO', 'DOING', 'DONE'].includes(newStatus)) {
                    return event.reply('❌ Uso: `rp!kanban move [ID] [TODO|DOING|DONE]`');
                }

                const task = await KanbanModel.findOneAndUpdate(
                    { guildId, shortId: targetId }, 
                    { status: newStatus }
                );

                if (!task) return event.reply(`❌ Tarefa \`#${targetId}\` não encontrada.`);

                await refreshLiveBoard(guildId, client); // <- MAGIA DO TEMPO REAL AQUI!
                return event.reply(`➡️ Tarefa \`#${targetId}\` movida para **${newStatus}**!`);
            }

            // ==========================================
            // DELETAR TAREFA
            // ==========================================
            if (subCommand === 'del' || subCommand === 'deletar') {
                const targetId = args[1]?.toUpperCase();

                if (!targetId) return event.reply('❌ Uso: `rp!kanban del [ID]`');

                const result = await KanbanModel.deleteOne({ guildId, shortId: targetId });

                if (result.deletedCount === 0) return event.reply(`❌ Tarefa \`#${targetId}\` não encontrada.`);

                await refreshLiveBoard(guildId, client); // <- MAGIA DO TEMPO REAL AQUI!
                return event.reply(`🗑️ Tarefa \`#${targetId}\` apagada da memória.`);
            }

            // ==========================================
            // CRIAR PAINEL FIXO (SHOW)
            // ==========================================
            if (subCommand === 'show' || subCommand === 'painel') {
                // Pega a menção do canal ou o próprio canal onde o comando foi digitado
                const targetChannel = isMessage ? event.mentions.channels.first() || event.channel : event.channel;

                if (!targetChannel) return event.reply('❌ Canal inválido.');

                const embed = await buildKanbanEmbed(guildId);
                const boardMessage = await targetChannel.send({ embeds: [embed] });

                // Salva ou atualiza a localização do painel no banco
                await KanbanBoardModel.findOneAndUpdate(
                    { guildId: guildId },
                    { channelId: targetChannel.id, messageId: boardMessage.id },
                    { upsert: true, new: true }
                );

                return event.reply(`📺 Painel fixo criado com sucesso em <#${targetChannel.id}>! Ele vai atualizar sozinho a partir de agora.`);
            }

            // ==========================================
            // VER (Mensagem Rápida)
            // ==========================================
            if (subCommand === 'ver' || subCommand === 'view') {
                const embed = await buildKanbanEmbed(guildId);
                return event.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Erro no Kanban:', error);
            return event.reply('❌ Erro no banco de dados. Olha o terminal.');
        }
    }
};