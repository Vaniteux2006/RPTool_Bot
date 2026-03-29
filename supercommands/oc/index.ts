import { Message } from 'discord.js';

import handleCreate from './handlers/create';
import handleDelete from './handlers/delete';
import handleRename from './handlers/rename';
import handleAvatar from './handlers/avatar';
import handleGroup from './handlers/group';
import handleExport from './handlers/export';
import handleImport from './handlers/import';
import handleList from './handlers/list';
import handleWiki from './handlers/wiki';

export default {
    name: 'oc',
    description: 'Sistema completo de OCs/Tuppers',
    execute: async (message: Message, args: string[]) => {
        const action = args[0]?.toLowerCase();
        const userId = message.author.id;

        if (!action) return message.reply("📝 Use `rp!oc help` para ver os comandos.");

        switch (action) {
            case 'create': return handleCreate(message, args, userId);
            case 'delete': return handleDelete(message, args, userId);
            case 'rename': return handleRename(message, args, userId);
            case 'avatar': return handleAvatar(message, args, userId);
            case 'group': return handleGroup(message, args, userId);
            case 'export': return handleExport(message, args, userId);
            case 'import': return handleImport(message, args, userId);
            case 'list': return handleList(message, args, userId);
            case 'wiki': return handleWiki(message, args, userId);
            default: return message.reply("❌ HTTP 418: I'm a teapot 🍵");
        }
    }
};