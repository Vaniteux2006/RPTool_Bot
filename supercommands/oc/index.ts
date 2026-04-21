import { Message } from 'discord.js';
import { OCModel } from '../../tools/models/OCSchema'; // Ajuste o caminho conforme o seu projeto

// Importação dos módulos que fragmentamos
import handleCreate from './handlers/create';
import handleDelete from './handlers/delete';
import handleRename from './handlers/rename';
import handleAvatar from './handlers/avatar';
import handleGroup from './handlers/group';
import handleExport from './handlers/export';
import handleImport from './handlers/import';
import handleList from './handlers/list';
import handleEdit from './handlers/edit';
import handlePrefix from './handlers/prefix';
import handlePurge from './handlers/purge';
import handleAI from './ai/ai';
import handleAlzheimer from './ai/alzheimer';
import handleGaslight from './ai/gaslight';
import handleForget from './ai/forget';
import handleInsert from './ai/insert';
import handleMemories from './ai/memories';
import handleDelay from './ai/delay';
import handleEnd from './ai/end';
import handleDuo from './social_handlers/duo';
import handleSolo from './social_handlers/solo';
import handleBirthday from './social_handlers/birthday';
import handleInfo from './social_handlers/info';
import handleWikiMain from "./wiki/index";


const confusedUsers = new Map<string, number>();

export default {
    name: 'oc',
    description: 'Gerencia seus OCs (Personagens)',
    aliases: ["tul", "tupper", "char", "t"],
    execute: async (message: Message, args: string[]) => {
        const userId = message.author.id;

        // Lógica original: Se não enviou argumentos, mostra o help ou ativa o Easter Egg!
        if (!args[0]) {
            const count = (confusedUsers.get(userId) || 0) + 1;
            confusedUsers.set(userId, count);

            if (count >= 5) {
                confusedUsers.delete(userId);

                const exists = await OCModel.findOne({ adminId: userId, name: "Nosferatu" });

                if (!exists) {
                    await message.reply("🙄 Que saco mano, não entendeu como cria personagem? Tá bom, vou fazer um pra ti.");

                    await OCModel.create({
                        adminId: userId,
                        name: "Nosferatu",
                        prefix: "Nosferatu:",
                        suffix: "",
                        avatar: "https://media.discordapp.net/attachments/1328881429446398044/1474440885117653033/image.png?ex=6999db94&is=69988a14&hm=fcf89f47a01871198f54afbf0a58e6ee4c61f59df04180efb64a763f5f629389&=&format=webp&quality=lossless",
                        createdAt: new Date()
                    });

                    return message.reply("✅ OC **Nosferatu** criado!\nExemplo: `Nosferatu:Oi`");
                }
            }

            return message.reply(`
**Comandos do RPTool OC:**
\`create, list, delete, avatar, prefix, name, edit\`
\`wiki (add, extra, ref, edit)\`
\`ai, persona, memories, gaslight, forget, insert, end\`
\`group, duo, solo, import, export, purge, birthday\`
Use \`rp!help oc\` para detalhes.
            `);
        }

        if (confusedUsers.has(userId)) confusedUsers.delete(userId);

        const action = args[0].toLowerCase();

        try {
            switch (action) {
                case 'create': return handleCreate(message, args, userId);
                case 'delete': return handleDelete(message, args, userId);
                case 'name': return handleRename(message, args, userId, action);
                case 'rename': return handleRename(message, args, userId, action); // Importante passar a "action" aqui como fizemos no `rename.ts`
                case 'avatar': return handleAvatar(message, args, userId);
                case 'group': return handleGroup(message, args, userId);
                case 'export': return handleExport(message, args, userId);
                case 'import': return handleImport(message, args, userId);
                case 'list': return handleList(message, args, userId);
                case 'wiki': return handleWikiMain(message, args, userId);
                case 'edit': return handleEdit(message, args, userId);
                case 'prefix': return handlePrefix(message, args, userId);
                case 'purge': return handlePurge(message, args, userId);
                case 'ai': return handleAI(message, args, userId);
                case 'alzheimer': return handleAlzheimer(message, args, userId);
                case 'gaslight': return handleGaslight(message, args, userId);
                case 'forget': return handleForget(message, args, userId);
                case 'insert': return handleInsert(message, args, userId);
                case 'memories': return handleMemories(message, args, userId);
                case 'delay': return handleDelay(message, args, userId);
                case 'end': return handleEnd(message, args, userId);
                case 'duo': return handleDuo(message, args, userId);
                case 'solo': return handleSolo(message, args, userId);
                case 'birthday': return handleBirthday(message, args, userId);
                case 'info': return handleInfo(message, args, userId);
                default:
                    return message.reply("🚫 HTTP 418: I'm a teapot. 🍵 (Comando inválido, apenas sou uma chaleira de chá)");
            }

        } catch (error) {
            console.error(error);
            message.reply("❌ Erro interno.");
        }
    }
};