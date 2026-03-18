// AVISO
// ESTÁ EM PRODUÇÃO.
// ESTÁ SENDO FEITO POR IVANOL

import { SlashCommandBuilder, ChatInputCommandInteraction, Message, AttachmentBuilder } from 'discord.js';
import { generateRealStats, generateDashboard } from '../tools/analytics';

export default {
name: 'dashboard',
description: 'Mostra analytics detalhados do servidor em formato de imagem.',
aliases: ['saas', 'painel'],

data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Mostra analytics do servidor'),

async execute(message: Message, args: string[]) {
    if (!message.guild) return message.reply("❌ Comando apenas para servidores.");
    
    const loading = await message.reply("📊 **Coletando dados...** *(Isso pode levar alguns segundos)*");
    
    try {
        const stats = await generateRealStats(message.guild);
        const buffer = await generateDashboard(message.guild, stats);
        const attachment = new AttachmentBuilder(buffer, { name: 'dashboard.png' });
        
        await loading.edit({ content: null, files: [attachment] });
    } catch (error) {
        console.error("Erro no dashboard:", error);
        await loading.edit("❌ Ocorreu um erro ao gerar o painel analítico.");
    }
},

async executeSlash(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return interaction.reply({ content: "❌ Comando apenas para servidores.", ephemeral: true });
    
    await interaction.deferReply();
    
    try {
        const stats = await generateRealStats(interaction.guild);
        const buffer = await generateDashboard(interaction.guild, stats);
        const attachment = new AttachmentBuilder(buffer, { name: 'dashboard.png' });
        
        await interaction.editReply({ files: [attachment] });
    } catch (error) {
        console.error("Erro no dashboard:", error);
        await interaction.editReply("❌ Ocorreu um erro ao gerar o painel analítico.");
    }
}
};