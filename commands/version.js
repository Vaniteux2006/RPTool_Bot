const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ReturnVersion = require('../ReturnVersion.js');

module.exports = {
    name: 'version',
    description: 'Mostra a versão atual do sistema',

    data: new SlashCommandBuilder()
        .setName('version')
        .setDescription('Mostra a versão do sistema'),

    async executeSlash(interaction) {
        const embed = this.getEmbed();
        await interaction.reply({ embeds: [embed] });
    },

    execute(message) {
        const embed = this.getEmbed();
        message.reply({ embeds: [embed] });
        console.log("Registrado Checagem de versão");
    },

    getEmbed() {
        const versionPath = path.join(__dirname, '../Data/version.json');
        let versionData = { current_display: "Desconhecida" };

        try {
            const rawData = fs.readFileSync(versionPath);
            versionData = JSON.parse(rawData);
        } catch (error) {
            console.error("Erro ao ler versão:", error);
        }

        return new EmbedBuilder()
            .setColor(0x00FFFF) // Ciano
            .setTitle('🤖 Versão do Sistema')
            .setDescription(`Atualmente operando na build:\n# \`${versionData.current_display}\``)
            .setFooter({ text: `RPTool • ${ReturnVersion()}` })
            .setTimestamp();
    }
};