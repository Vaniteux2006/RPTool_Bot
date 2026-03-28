import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Message } from 'discord.js';
import { Schema, model, models, Document } from 'mongoose';

// ---------------------------------------------------------
// REQUISITO DE DADOS
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

export default {
    // ---------------------------------------------------------
    // REQUISITOS FUNCIONAIS (Para o Slash Command)
    // ---------------------------------------------------------
    data: new SlashCommandBuilder()
        .setName('kanban')
        .setDescription('Gerencia suas tarefas de desenvolvimento do bot')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adiciona uma nova tarefa no quadro')
                .addStringOption(option =>
                    option.setName('tarefa')
                        .setDescription('O que precisa ser feito?')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('status')
                        .setDescription('Qual o status atual?')
                        .setRequired(true)
                        .addChoices(
                            { name: 'A Fazer (TODO)', value: 'TODO' },
                            { name: 'Fazendo (DOING)', value: 'DOING' },
                            { name: 'Concluído (DONE)', value: 'DONE' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Mostra o quadro Kanban do servidor')),

    // ---------------------------------------------------------
    // CENÁRIO DE USO HÍBRIDO (Slash + Prefixo)
    // ---------------------------------------------------------
    async execute(event: ChatInputCommandInteraction | Message, args?: string[]) {
        // 1. Descobrir quem chamou o gatilho
        const isMessage = event instanceof Message;
        const guildId = event.guildId;
        const userId = isMessage ? event.author.id : event.user.id;

        if (!guildId) {
            const replyText = '❌ Esse comando só pode ser usado em um servidor.';
            return isMessage ? event.reply(replyText) : (event as ChatInputCommandInteraction).reply({ content: replyText, ephemeral: true });
        }

        // 2. Extrair o subcomando dependendo do gatilho
        let subCommand = '';
        if (isMessage && args) {
            subCommand = args[0]?.toLowerCase(); // Ex: rp!kanban add ... -> 'add'
        } else {
            subCommand = (event as ChatInputCommandInteraction).options.getSubcommand();
        }

        try {
            // ==========================================
            // CENÁRIO 1: ADICIONAR TAREFA
            // ==========================================
            if (subCommand === 'add') {
                let title = '';
                let status = '';

                // Se for por prefixo, a gente extrai do array de args
                if (isMessage && args) {
                    status = args[1]?.toUpperCase(); // Ex: 'TODO'
                    title = args.slice(2).join(' '); // Junta o resto da frase: "Fazer inventário"

                    // Tratamento de exceção pro usuário digitando errado no chat
                    if (!['TODO', 'DOING', 'DONE'].includes(status) || !title) {
                        return event.reply('❌ Uso correto: `rp!kanban add [TODO|DOING|DONE] [Sua tarefa aqui]`\nExemplo: `rp!kanban add TODO Fazer sistema de XP`');
                    }
                } 
                // Se for Slash, pega bonitinho das options
                else {
                    title = (event as ChatInputCommandInteraction).options.getString('tarefa', true);
                    status = (event as ChatInputCommandInteraction).options.getString('status', true);
                }
                
                const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();

                await KanbanModel.create({ guildId, userId, shortId, title, status });

                const replyText = `✅ Tarefa \`#${shortId}\` (**${title}**) salva com sucesso na coluna **${status}**!`;
                return isMessage ? event.reply(replyText) : (event as ChatInputCommandInteraction).reply({ content: replyText, ephemeral: true });
            }

            // ==========================================
            // CENÁRIO 2: VER O QUADRO
            // ==========================================
            if (subCommand === 'ver') {
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

                return event.reply({ embeds: [embed] });
            }

            // ==========================================
            // EXCEÇÃO: SUBCOMANDO INVÁLIDO (Só ocorre no prefixo)
            // ==========================================
            if (isMessage) {
                return event.reply('❌ Subcomando inválido. Use `rp!kanban add` ou `rp!kanban ver`.');
            }

        } catch (error) {
            console.error('Erro no Kanban:', error);
            const errorText = '❌ Deu pau ao conectar com o banco de dados. Olha o console.';
            return isMessage ? event.reply(errorText) : (event as ChatInputCommandInteraction).reply({ content: errorText, ephemeral: true });
        }
    },
};