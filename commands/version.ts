import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import fs from 'fs';
import path from 'path';
// CORREÇÃO: Importando do jeito TS e sem extensão .js
import ReturnVersion from '../ReturnVersion'; 

export default {
    name: 'version',
    description: 'Mostra a versão atual do sistema',

    data: new SlashCommandBuilder()
        .setName('version')
        .setDescription('Mostra a versão do sistema'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const embed = this.getEmbed();
        await interaction.reply({ embeds: [embed] });
    },

    execute(message: Message) {
        const embed = this.getEmbed();
        message.reply({ embeds: [embed] });
    },

    getEmbed() {
        const versionPath = path.join(__dirname, '../Data/version.json');
        let versionData = { current_display: "Desconhecida" };

        try {
            if (fs.existsSync(versionPath)) {
                const rawData = fs.readFileSync(versionPath, 'utf-8');
                versionData = JSON.parse(rawData);
            }
        } catch (error) {
            console.error("Erro ao ler versão:", error);
        }

        // Chama a função importada
        const displayVer = ReturnVersion();

        return new EmbedBuilder()
            .setColor(0x00FFFF)
            .setTitle('🤖 Versão do Sistema')
            .setDescription(`Atualmente operando na build:\n# \`${displayVer}\``)
            .setFooter({ text: 'TypeScript Update 🚀' });
    }
};