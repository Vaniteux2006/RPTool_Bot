import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import ReturnVersion from '../ReturnVersion'; 

export default {
    name: 'version',
    description: 'Mostra a versão atual do sistema e os créditos.',
    aliases: ['creditos', 'credits', 'info'], 

    data: new SlashCommandBuilder()
        .setName('version')
        .setDescription('Mostra a versão do sistema e os créditos da equipe'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const embed = this.getEmbed();
        await interaction.reply({ embeds: [embed] });
    },

    execute(message: Message) {
        const embed = this.getEmbed();
        message.reply({ embeds: [embed] });
    },

    getEmbed() {
        const displayVer = ReturnVersion();

        return new EmbedBuilder()
            .setColor(0x00FFFF)
            .setTitle('🤖 RPTool - Versão e Créditos')
            .setDescription(`Atualmente operando na build:\n# \`${displayVer}\`\n\nEste projeto épico foi forjado por estas lendas:`)
            .addFields(
                { name: '👑 Fundador, Idealizador & Dev', value: '> **vaniteux_reborn**', inline: false },
                { name: '💻 Co-Fundador & Dev', value: '> **mr.ivanol**', inline: false },
                { name: '🎨 Ilustrador (Avatar)', value: '> **skieeeell**', inline: false }
            )
            .setFooter({ text: 'TypeScript Update 🚀' });
    }
};