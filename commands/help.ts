// RPTool/commands/help.ts
// ─── REDIRECIONADO ────────────────────────────────────────────────────────────
// O help agora é um supercommand (wiki interativa de comandos):
//   supercommands/help/registry.ts — conteúdo (edite AQUI pra atualizar o help)
//   supercommands/help/index.ts    — navegação, busca e paginação
//
// Este shim existe porque apenas o loader de /commands registra slash commands
// no deploy (commandsArray do index.ts) — sem ele, o /help deixaria de existir.

import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';

// Redireciona para o supercommand real
const helpSuper = (() => {
    try {
        return require('../supercommands/help/index').default;
    } catch {
        return null;
    }
})();

export default {
    name:        'help',
    description: '(Redirecionado) → supercommands/help',
    aliases:     ['ajuda', 'comandos'],

    data: helpSuper?.data ?? new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra a Central de Ajuda interativa'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        if (helpSuper?.executeSlash) return helpSuper.executeSlash(interaction);
        return interaction.reply({ content: '❌ Módulo de ajuda não encontrado em supercommands/help/index.ts', ephemeral: true });
    },

    async execute(message: Message, args: string[]) {
        if (helpSuper?.execute) return helpSuper.execute(message, args);
        return message.reply('❌ Módulo de ajuda não encontrado em supercommands/help/index.ts');
    },
};
