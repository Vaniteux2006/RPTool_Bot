const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'helloworld',
    description: 'Teste de conexão e latência',
    
    data: new SlashCommandBuilder()
        .setName('helloworld')
        .setDescription('Teste de conexão e latência'),

    execute(message, args) {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`Hello World! Conexão de ${ping}ms.`);
        console.log("Registrado Hello World (Legacy)");
    },

    async executeSlash(interaction) {
        const ping = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`Hello World! Conexão de ${ping}ms.`);
        console.log("Registrado Hello World (Slash)");
    },
};