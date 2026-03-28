import { Message, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Schema, model, models, Document } from 'mongoose';
import { Command } from '../tools/interfaces/Command'; // <-- Puxando a sua interface!

// ---------------------------------------------------------
// REQUISITO DE DADOS (MongoDB)
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// EXPORTANDO NO SEU PADRÃO (Igual o oc.ts)
// ---------------------------------------------------------
export const command: Command = {
    name: "kanban",
    description: "Gerencia suas tarefas de desenvolvimento do bot",
    aliases: ["kb", "tasks"], // Pode usar rp!kb também pra ir mais rápido
    execute: async (event: Message | ChatInputCommandInteraction | any, args: string[]) => {
        
        // 1. Descobrir quem chamou o gatilho (Prefixo ou Slash)
        const isMessage = !!event.content; // Se tem "content", é Message (Prefixo)
        const guildId = event.guildId;
        const userId = isMessage ? event.author.id : event.user?.id;

        if (!guildId) {
            return isMessage ? event.reply('❌ Esse comando só pode ser usado em um servidor.') 
                             : event.reply({ content: '❌ Esse comando só pode ser usado em um servidor.', ephemeral: true });
        }

        // 2. Extrair o subcomando
        let subCommand = '';
        if (isMessage && args.length > 0) {
            subCommand = args[0]?.toLowerCase(); // Ex: rp!kanban add
        } else if (!isMessage && event.options) {
            subCommand = event.options.getSubcommand();
        } else {
            return event.reply('❌ Use: `rp!kanban add [TODO|DOING|DONE] [Tarefa]` ou `rp!kanban ver`');
        }

        try {
            // ==========================================
            // CENÁRIO 1: ADICIONAR TAREFA
            // ==========================================
            if (subCommand === 'add') {
                let title = '';
                let status = '';

                if (isMessage) {
                    status = args[1]?.toUpperCase(); 
                    title = args.slice(2).join(' '); 

                    if (!['TODO', 'DOING', 'DONE'].includes(status) || !title) {
                        return event.reply('❌ Uso correto: `rp!kanban add [TODO|DOING|DONE] [Sua tarefa aqui]`');
                    }
                } else {
                    title = event.options.getString('tarefa', true);
                    status = event.options.getString('status', true);
                }
                
                const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();

                await KanbanModel.create({ guildId, userId, shortId, title, status });

                const replyText = `✅ Tarefa \`#${shortId}\` (**${title}**) salva com sucesso na coluna **${status}**!`;
                return isMessage ? event.reply(replyText) : event.reply({ content: replyText, ephemeral: true });
            }

            // ==========================================
            // CENÁRIO 2: VER O QUADRO
            // ==========================================
            if (subCommand === 'ver' || subCommand === 'view') {
                const tasks = await KanbanModel.find({ guildId: guildId });

                const todoTasks = tasks.filter(t => t.status === 'TODO').map(t => `\`#${t.shortId}\` ${t.title} (<@${t.userId}>)`).join('\n') || 'Vazio';
                const doingTasks = tasks.filter(t => t.status === 'DOING').map(t => `\`#${t.shortId}\` ${t.title} (<@${t.userId}>)`).join('\n') || 'Vazio';
                const doneTasks = tasks.filter(t => t.status === 'DONE').map(t => `\`#${t.shortId}\` ${t.title} (<@${t.userId}>)`).join('\n') || 'Vazio';

                const embed = new EmbedBuilder()
                    .setTitle('📋 Kanban do Servidor')
                    .setDescription('Tarefas salvas no DB_RESTANTE')
                    .setColor('#00FF00')
                    .addFields(
                        { name: '🔴 A Fazer (TODO)', value: todoTasks, inline: false },
                        { name: '🟡 Fazendo (DOING)', value: doingTasks, inline: false },
                        { name: '🟢 Concluído (DONE)', value: doneTasks, inline: false }
                    )
                    .setFooter({ text: 'Sistema de Requisitos Operante' });

                return isMessage ? event.reply({ embeds: [embed] }) : event.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Erro no Kanban:', error);
            return isMessage ? event.reply('❌ Erro no banco de dados.') : event.reply({ content: '❌ Erro no banco de dados.', ephemeral: true });
        }
    }
};