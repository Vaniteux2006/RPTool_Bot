// RPTool/commands/futebol.ts
// ─── Shim de slash ────────────────────────────────────────────────────────────
// O futebol é um supercommand completo em supercommands/futebol/. Este arquivo
// existe apenas para registrar o slash /futebol no deploy (supercommands não são
// varridos pelo deploy de slash — mesmo padrão do commands/chess.ts).
import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';

const futebolSuper = (() => {
    try { return require('../supercommands/futebol/index').default; }
    catch { return null; }
})();

export default {
    name: 'futebol',
    description: 'Motor de Simulação Tática de Futebol — RPTool ⚽',
    aliases: ['fb', 'fut', 'football'],

    data: new SlashCommandBuilder()
        .setName('futebol')
        .setDescription('Simulador tático de futebol: clubes, partidas e torneios'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        return interaction.reply({
            content: '⚽ O futebol funciona por comandos de texto. Use `rp!futebol` para ver o painel completo.',
            ephemeral: true,
        });
    },

    execute: async (message: Message, args: string[]) => {
        if (futebolSuper?.execute) return futebolSuper.execute(message, args);
        return message.reply('❌ Módulo de futebol não encontrado em supercommands/futebol/index.ts');
    },
};
