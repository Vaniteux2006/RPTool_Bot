// RPTool/tools/utils/eventLoader.ts
// ─── Carregador de eventos por intent ────────────────────────────────────────
// Lê todos os arquivos de /events/ e registra os listeners no Client.
// Cada arquivo exporta um array de { name, once, execute }.
//
// IMPORTANTE sobre duplicatas:
//   - Events.MessageCreate é registrado no index.ts para o roteamento de comandos.
//   - Os handlers de messageEvents.ts e dmEvents.ts fazem guard (isDMBased, etc.)
//     para não conflitar. Manter essa separação de responsabilidade.
//   - Events.GuildMemberAdd é registrado em memberEvents.ts;
//     o bloco manual do index.ts deve ser REMOVIDO para evitar dupla execução.
import { Client } from 'discord.js';
import * as path from 'path';
import * as fs from 'fs';

// ─── Ordem de carregamento (por volume crescente de eventos) ──────────────────
// Arquivos de maior volume ficam por último para facilitar debug dos primeiros.
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
    'pollEvents',
    'reactionEvents',
    'messageEvents',
    'voiceEvents',
];

export function loadEvents(client: Client): void {
    const eventsDir = path.join(__dirname, '../../events');
    let totalLoaded = 0;

    for (const fileName of EVENT_FILES_ORDER) {
        const filePath = path.join(eventsDir, `${fileName}.ts`);

        // Tenta .ts primeiro; fallback .js para produção compilada
        const resolvedPath = fs.existsSync(filePath)
            ? filePath
            : filePath.replace('.ts', '.js');

        if (!fs.existsSync(resolvedPath)) {
            console.warn(`⚠️ [EventLoader] Arquivo não encontrado: ${fileName}`);
            continue;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const module = require(resolvedPath);
            const handlers: any[] = Array.isArray(module.default)
                ? module.default
                : [module.default];

            for (const handler of handlers) {
                if (!handler?.name || typeof handler.execute !== 'function') {
                    console.warn(`⚠️ [EventLoader] Handler inválido em ${fileName}`);
                    continue;
                }

                if (handler.once) {
                    client.once(handler.name, (...args) => handler.execute(...args, client));
                } else {
                    client.on(handler.name, (...args) => handler.execute(...args, client));
                }

                totalLoaded++;
            }

            console.log(`✅ [EventLoader] ${fileName} — ${handlers.length} handler(s) registrado(s)`);
        } catch (e) {
            console.error(`❌ [EventLoader] Erro ao carregar ${fileName}:`, e);
        }
    }

    console.log(`🎯 [EventLoader] Total: ${totalLoaded} listener(s) registrado(s).`);
}