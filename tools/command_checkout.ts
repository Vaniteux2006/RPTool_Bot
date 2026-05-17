// RPTool/tools/command_checkout.ts
// ─── Checkout de Mensagens / Comandos de Texto ────────────────────────────────
// Responsabilidade: prefixo rp!, cooldowns, stats e inicialização de rotinas.
// Cada comando se auto-registra via EventCheckout.onMessageCreate() no próprio arquivo.
import { Message, Client } from 'discord.js';
import { EventCheckout } from './event_checkout';

// ─── Importações de auto-registro ────────────────────────────────────────────
// Basta importar — o EventCheckout.onMessageCreate() em cada arquivo
// faz o registro automaticamente ao ser carregado.
import '../commands/42';
import '../commands/roll';
import '../supercommands/phone';
import '../supercommands/tempo';

// ─── Rotinas de inicialização ─────────────────────────────────────────────────
import birthdayCmd from '../commands/birthday';
import ServerStats from './models/ServerStats';

let routinesInitialized = false;

async function initRoutines(client: Client): Promise<void> {
    if (routinesInitialized) return;
    routinesInitialized = true;

    setInterval(
        () => birthdayCmd.updateBirthdayPanels(client).catch(e => console.error('[Rotina] Aniversários:', e)),
        1000 * 60 * 60,
    );

    console.log('🛠️ [Checkout] Rotinas inicializadas.');
}

// ─── Tracking de stats de mensagem ───────────────────────────────────────────
async function trackMessageStats(message: Message): Promise<void> {
    if (!message.guild) return;

    const stopWords = new Set([
        'como','para','você','isso','mais','pelo','pela','esse','essa',
        'este','esta','tudo','nada','quem','onde','quando','porque','qual',
        'aqui','sobre','então','muito','dela','dele','https','view','tenor',
        'cara','minha','tenho','tava','fazer','pode','acho','assim','agora',
    ]);

    const content  = message.content.toLowerCase();
    const rawWords = content.match(/[a-záàâãéèêíïóôõöúçñ]+/g) ?? [];
    const wordCounts: Record<string, number> = {};

    for (const w of rawWords) {
        if (w.length > 4 && !stopWords.has(w)) {
            const key = `words.${w}`;
            wordCounts[key] = (wordCounts[key] ?? 0) + 1;
        }
    }

    const userId  = message.webhookId ?? message.author.id;
    const dateStr = new Date().toISOString().split('T')[0];
    const hour    = new Date().getUTCHours();

    ServerStats.findOneAndUpdate(
        { guildId: message.guild.id, date: dateStr, hour },
        { $inc: { total: 1, [`users.${userId}`]: 1, [`channels.${message.channel.id}`]: 1, ...wordCounts } },
        { upsert: true },
    ).catch(e => console.error('[DB] ServerStats:', e));
}

// ─── Handler central registrado no EventCheckout ──────────────────────────────
EventCheckout.onMessageCreate('__system.checkout', async (message: Message) => {
    if (message.author.bot) return false;
    trackMessageStats(message).catch(() => null);
    await initRoutines(message.client as Client);
    return false; // não consome — outros handlers continuam
});

// ─── FIX: export default para compatibilidade com index.ts ───────────────────
// O index.ts faz: import runSystemChecks from './tools/command_checkout'
// e chama: await runSystemChecks(message, client)
// Com o EventCheckout, o processamento real já foi delegado acima.
// Esta função mantém o contrato de retorno booleano que o index.ts espera.
export default async function runSystemChecks(message: Message, _client: Client): Promise<boolean> {
    // O processamento agora ocorre via EventCheckout.dispatch internamente.
    // Retorna false para que o index.ts continue com o roteamento de comandos.
    return false;
}