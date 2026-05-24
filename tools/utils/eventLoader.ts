// RPTool/tools/utils/eventLoader.ts
// ─── Loader de Subscriber Files ───────────────────────────────────────────────
//
// ⚠️  NOTA ARQUITETURAL:
//   Com a introdução do initEventCheckout(), o roteamento de eventos do Discord
//   para handlers já é feito automaticamente. Os arquivos em /events/ agora são
//   "subscriber registrars" — ao serem importados, suas chamadas a
//   EventCheckout.onX() registram os handlers no dispatcher.
//
//   Este loader existe para garantir que os arquivos de /events/ sejam carregados
//   mesmo que nenhum comando os importe diretamente.
//   Arquivos de /commands/ e /supercommands/ se auto-inscrevem ao ser carregados
//   pelo loadCommands() no index.ts e NÃO precisam passar por aqui.
//
// USO NO index.ts:
//   NÃO é mais necessário chamar loadEvents(client). Use initEventCheckout(client).
//   Se quiser carregar os arquivos de /events/ mesmo assim (para os subscribers
//   centrais deles), chame loadEventSubscribers() ANTES de initEventCheckout().

import * as path from 'path';
import * as fs from 'fs';

const EVENT_FILES_ORDER = [
    'memberEvents',
    'roleEvents',
    'guildEvents',
    'moderationEvents',
    'expressionEvents',
    'inviteEvents',
    'integrationEvents',
    'scheduledEventEvents',
    'autoModerationEvents',
    'Pollevents',
    'reactionEvents',
    'messageEvents',
    'voiceEvents',
];

/** Carrega os arquivos de /events/ para disparar seus side-effects de inscrição. */
export function loadEventSubscribers(): void {
    const eventsDir = path.join(__dirname, '../../events');
    let loaded = 0;

    for (const fileName of EVENT_FILES_ORDER) {
        const filePath = path.join(eventsDir, `${fileName}.ts`);
        const resolvedPath = fs.existsSync(filePath)
            ? filePath
            : filePath.replace('.ts', '.js');

        if (!fs.existsSync(resolvedPath)) {
            console.warn(`⚠️ [EventLoader] Arquivo não encontrado: ${fileName}`);
            continue;
        }

        try {
            require(resolvedPath); // side-effect: chama EventCheckout.onX() internamente
            loaded++;
            console.log(`✅ [EventLoader] ${fileName} carregado`);
        } catch (e) {
            console.error(`❌ [EventLoader] Erro ao carregar ${fileName}:`, e);
        }
    }

    console.log(`🎯 [EventLoader] ${loaded} arquivo(s) de subscriber carregado(s).`);
}
