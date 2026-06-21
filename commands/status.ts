// RPTool/commands/status.ts
// ─── REDIRECIONADO ────────────────────────────────────────────────────────────
// O status agora é um supercommand:
//   supercommands/status/index.ts             — roteador, overview, rankings top-5, gráficos
//   supercommands/status/interactions.ts      — botões de ranking paginado + modal de data
//   supercommands/status/handlers/backfill.ts — rp!status docpast (varredura do passado)
//
// Este shim existe porque apenas o loader de /commands registra slash commands
// no deploy (commandsArray do index.ts) — sem ele, o /status deixaria de existir.
import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';

// Redireciona para o supercommand real
const statusSuper = (() => {
    try {
        return require('../supercommands/status/index').default;
    } catch {
        return null;
    }
})();

export default {
    name:        'status',
    description: '(Redirecionado) → supercommands/status',
    aliases:     ['stats', 'dashboard', 'rank'],

    data: statusSuper?.data ?? new SlashCommandBuilder()
        .setName('status')
        .setDescription('Mostra estatísticas completas do servidor'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        if (statusSuper?.executeSlash) return statusSuper.executeSlash(interaction);
        return interaction.reply({ content: '❌ Módulo de status não encontrado em supercommands/status/index.ts', ephemeral: true });
    },

    async execute(message: Message, args: string[]) {
        if (statusSuper?.execute) return statusSuper.execute(message, args);
        return message.reply('❌ Módulo de status não encontrado em supercommands/status/index.ts');
    },
};
