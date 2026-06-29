// RPTool/commands/chess.ts
// ─── DEPRECADO (shim) ─────────────────────────────────────────────────────────
// O xadrez virou um supercommand completo (PvP + Stockfish + modais) em:
//   supercommands/chess/index.ts        — entrada do comando e tabuleiro
//   supercommands/chess/interactions.ts — convites, dificuldade e lances
//   supercommands/chess/engine.ts       — wrapper do Stockfish
//   supercommands/chess/parse.ts        — parser de lances multi-notação
//
// Este arquivo só mantém `rp!chess` funcionando e expõe um slash `/chess` enxuto
// (supercommands não são varridos pelo deploy de slash — por isso o shim aqui).
import { SlashCommandBuilder, ChatInputCommandInteraction, Message, Collection } from 'discord.js';

const chessSuper = (() => {
    try { return require('../supercommands/chess/index').default; }
    catch { return null; }
})();

export default {
    name: 'chess',
    description: 'Jogue Xadrez contra outro membro ou contra o Stockfish.',
    aliases: ['xadrez'],

    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Jogue Xadrez (contra um membro ou o Stockfish)')
        .addUserOption(op => op.setName('oponente').setDescription('Quem você quer desafiar (você joga de pretas)'))
        .addBooleanOption(op => op.setName('bot').setDescription('Jogar contra o Stockfish')),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        if (!chessSuper?.execute) {
            return interaction.reply({ content: '❌ Módulo de xadrez não encontrado.', ephemeral: true });
        }
        await interaction.deferReply();

        const opponent = interaction.options.getUser('oponente');
        const vsBot = interaction.options.getBoolean('bot');

        // Reconstrói um "message" mínimo que o supercommand espera (mentions + reply).
        const fakeMsg: any = {
            author: interaction.user,
            channelId: interaction.channelId,
            mentions: { users: new Collection(opponent ? [[opponent.id, opponent]] : []) },
            reply: (c: any) => interaction.editReply(c),
        };
        const args = vsBot ? ['bot'] : [];
        await chessSuper.execute(fakeMsg, args);
    },

    execute: async (message: Message, args: string[]) => {
        if (chessSuper?.execute) return chessSuper.execute(message, args);
        return message.reply('❌ Módulo de xadrez não encontrado em supercommands/chess/index.ts');
    },
};
