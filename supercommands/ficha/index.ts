// RPTool/supercommands/ficha/index.ts
import { Message } from 'discord.js';
import handleTemplate from './handlers/template';
import handleView     from './handlers/view';
import handleNew      from './handlers/new';
import handleCheck    from './handlers/check';
import handleShow     from './handlers/show';

const HELP = `
📋 **Sistema de Fichas — rp!ficha**

\`rp!ficha template\`       → Cria/edita o modelo de ficha do servidor *(admin)*
\`rp!ficha check #canal\`   → Define o canal de aprovação das fichas *(admin)*
\`rp!ficha show #canal\`    → Define o canal público de exibição de resultados *(admin)*
\`rp!ficha view\`           → Exibe o modelo atual e os canais configurados

\`rp!ficha new\`            → Preenche a ficha na DM
\`rp!ficha new +oc\`        → Preenche a ficha e cria o OC automaticamente ao ser aprovado
`.trim();

export default {
    name: 'ficha',
    aliases: ['form', 'sheet'],
    description: 'Sistema automático de Fichas (RP)',

    execute: async (message: Message, args: string[]) => {
        const action = args[0]?.toLowerCase();

        switch (action) {
            case 'template':
                return handleTemplate(message, args.slice(1));

            case 'check':
                return handleCheck(message, args.slice(1));

            case 'show':
                return handleShow(message, args.slice(1));

            case 'view':
            case 'edit':   // alias legado
                return handleView(message, args.slice(1));

            case 'new':
            case 'start':  // alias legado
                return handleNew(message, args.slice(1));

            default:
                return message.reply(HELP);
        }
    },
};