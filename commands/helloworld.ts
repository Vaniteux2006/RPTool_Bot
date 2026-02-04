import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';

export default {
    name: 'helloworld',
    description: 'Teste de conexão e latência',
    
    data: new SlashCommandBuilder()
        .setName('helloworld')
        .setDescription('Teste de conexão e latência'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const ping = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`Hello World! Conexão de ${ping}ms.`);
    },

    execute(message: Message, args: string[]) {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`Hello World! Conexão de ${ping}ms.`);
    },
};