"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ReturnVersion_1 = __importDefault(require("../ReturnVersion"));
exports.default = {
    name: 'version',
    description: 'Mostra a versão atual do sistema e os créditos.',
    aliases: ['creditos', 'credits', 'info'],
    data: new discord_js_1.SlashCommandBuilder()
        .setName('version')
        .setDescription('Mostra a versão do sistema e os créditos da equipe'),
    async executeSlash(interaction) {
        const embed = this.getEmbed();
        await interaction.reply({ embeds: [embed] });
    },
    execute(message) {
        const embed = this.getEmbed();
        message.reply({ embeds: [embed] });
    },
    getEmbed() {
        const displayVer = (0, ReturnVersion_1.default)();
        return new discord_js_1.EmbedBuilder()
            .setColor(0x00FFFF)
            .setTitle('🤖 RPTool - Versão e Créditos')
            .setDescription(`Atualmente operando na build:\n# \`${displayVer}\`\n\nEste projeto épico foi forjado por estas lendas:`)
            .addFields({ name: '👑 Fundador, Idealizador & Dev', value: '> **vaniteux_reborn**', inline: false }, { name: '💻 Co-Fundador & Dev', value: '> **mr.ivanol**', inline: false }, { name: '🎨 Ilustrador (Avatar)', value: '> **skieeeell**', inline: false })
            .setFooter({ text: 'TypeScript Update 🚀' });
    }
};
