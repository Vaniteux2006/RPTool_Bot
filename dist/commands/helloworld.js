"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    name: 'helloworld',
    description: 'Teste de conexão e latência',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('helloworld')
        .setDescription('Teste de conexão e latência'),
    async executeSlash(interaction) {
        const ping = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`Hello World! Conexão de ${ping}ms.`);
    },
    execute(message, args) {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`Hello World! Conexão de ${ping}ms.`);
    },
};
