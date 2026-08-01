// RPTool/supercommands/ficha/index.ts
// Comando prefix-only (rp!ficha) — sem registro de slash (ver DOCUMENTACAO.md).
import { Message } from 'discord.js';
import handleTemplate        from './handlers/template';
import handleView            from './handlers/view';
import handleNew             from './handlers/new';
import handleCheck           from './handlers/check';
import handleShow            from './handlers/show';
import handleSubmit          from './handlers/submit';
import { handleAutoDetect }  from './handlers/autodetect';
import { EventCheckout }     from '../../tools/eventCheckout';

// Registra o listener de auto-detecção de fichas no canal de envio
EventCheckout.onMessageCreate('ficha:autodetect', handleAutoDetect);

// ─── Help ─────────────────────────────────────────────────────────────────────
const HELP = `
📋 **Sistema de Fichas — rp!ficha**

\`rp!ficha template\`        → Cria/edita o modelo de ficha do servidor *(admin)*
\`rp!ficha check #canal\`    → Define o canal de aprovação das fichas *(admin)*
\`rp!ficha show #canal\`     → Define o canal público de exibição de resultados *(admin)*
\`rp!ficha submit #canal\`   → Define o canal onde os jogadores postam as fichas diretamente *(admin)*
\`rp!ficha view\`            → Exibe o modelo atual e os canais configurados

\`rp!ficha new\`             → Preenche a ficha na DM
\`rp!ficha new +oc\`         → Preenche a ficha e cria o OC automaticamente ao ser aprovado
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
            case 'submit':
            case 'canal':
                return handleSubmit(message, args.slice(1));
            case 'view':
            case 'edit':
                return handleView(message, args.slice(1));
            case 'new':
            case 'start':
                return handleNew(message, args.slice(1));
            default:
                return message.reply(HELP);
        }
    },
};
