// RPTool/supercommands/ficha/index.ts
import { Message } from "discord.js";
import handleTemplate from "./handlers/template";
import handleView from "./handlers/view";
import handleStart from "./handlers/start";

export default {
    name: 'ficha',
    aliases: ['form'],
    description: 'Sistema automático de Fichas (RP)',
    execute: async (message: Message, args: string[]) => {
        const action = args[0]?.toLowerCase();

        switch (action) {
            case 'template':
                return handleTemplate(message, args);
            case 'view':
                return handleView(message, args);
            case 'start':
                return handleStart(message, args);
            default:
                return message.reply("📖 **Uso do Sistema de Fichas:**\n`rp!ficha template` - Criar o modelo do servidor\n`rp!ficha view` - Ver o modelo atual\n`rp!ficha start` - Iniciar o preenchimento na sua DM");
        }
    }
}