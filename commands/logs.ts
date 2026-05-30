// RPTool/commands/logs.ts
// ─── DEPRECADO ────────────────────────────────────────────────────────────────
// Este arquivo existia antes da criação do supercommand de logs.
// O sistema de logs agora vive inteiramente em:
//   supercommands/logs/index.ts       — comandos de configuração (rp!logs)
//   supercommands/logs/events/        — handlers de log por categoria
//
// Este shim garante que `rp!logs` e os aliases antigos ainda funcionem
// mesmo que alguém não saiba que o comando foi movido.
// Pode ser deletado com segurança após confirmar que ninguém depende
// das importações antigas (ex: GuildConfigModel.logChannelId).

import { Message } from 'discord.js';

// Redireciona para o supercommand real
const logsSuper = (() => {
    try {
        return require('../supercommands/logs/index').default;
    } catch {
        return null;
    }
})();

export default {
    name: 'logs',
    description: '(Redirecionado) → supercommands/logs',
    aliases: ['log', 'auditoria', 'setlogs', 'audit'],

    execute: async (message: Message, args: string[]) => {
        if (logsSuper?.execute) return logsSuper.execute(message, args);
        return message.reply('❌ Módulo de logs não encontrado em supercommands/logs/index.ts');
    },
};
