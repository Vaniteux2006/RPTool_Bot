// RPTool/tools/commandCheckout.ts
// ─── Checkout de Mensagens / Comandos de Texto ────────────────────────────────
// Responsabilidade: prefixo rp!, cooldowns, stats e inicialização de rotinas.
// Cada comando se auto-registra via EventCheckout.onMessageCreate() no próprio arquivo.
import { Message, Client } from 'discord.js';
import { EventCheckout } from './eventCheckout';

// ─── Importações de auto-registro ────────────────────────────────────────────
// Basta importar — o EventCheckout.onMessageCreate() em cada arquivo
// faz o registro automaticamente ao ser carregado.
import '../commands/42';
import '../commands/roll';
import '../supercommands/phone';
import '../supercommands/tempo';
import './webhook';             // proxy de OC (oc:proxy) — auto-registra no MessageCreate
import './utils/aiUtils';       // IA de OC (oc:ai)      — auto-registra no MessageCreate
import './utils/statusRotator'; // status rotativo do bot — auto-registra no ClientReady
import './utils/telemetry';     // heartbeat + logs p/ o Watchdog — auto-registra no ClientReady
import './utils/watchdogRpc';   // consultas sob demanda do Watchdog — auto-registra no ClientReady

// ─── Rotinas de inicialização ─────────────────────────────────────────────────
import birthdayCmd from '../commands/birthday';
import { STOPWORDS } from './utils/stopwords';
import { recomputeAllAdvanced } from './utils/economyEngine';
import { bumpServerStat, bumpUserChannel } from './utils/statsBuffer';

let routinesInitialized = false;

async function initRoutines(client: Client): Promise<void> {
    if (routinesInitialized) return;
    routinesInitialized = true;

    setInterval(
        () => birthdayCmd.updateBirthdayPanels(client).catch(e => console.error('[Rotina] Aniversários:', e)),
        1000 * 60 * 60,
    );

    // Recalcula inflação/PIB dos servidores em modo econômico avançado.
    setInterval(
        () => recomputeAllAdvanced().catch(e => console.error('[Rotina] Economia:', e)),
        1000 * 60 * 60,
    );

    console.log('🛠️ [Checkout] Rotinas inicializadas.');
}

// ─── Tracking de stats de mensagem ───────────────────────────────────────────
// Não escreve no Mongo diretamente: acumula no statsBuffer (flush a cada 15s
// via bulkWrite). Reduz de 2 ops/mensagem para ~2 ops/servidor por ciclo —
// essencial para escalar além de ~60 msgs/s agregadas.
async function trackMessageStats(message: Message): Promise<void> {
    if (!message.guild) return;

    const content  = message.content.toLowerCase();
    const rawWords = content.match(/[a-záàâãéèêíïóôõöúçñ]+/g) ?? [];
    const wordCounts: Record<string, number> = {};

    for (const w of rawWords) {
        // palavras de 3+ letras que não sejam funcionais (ver tools/utils/stopwords.ts)
        if (w.length >= 3 && !STOPWORDS.has(w)) {
            const key = `words.${w}`;
            wordCounts[key] = (wordCounts[key] ?? 0) + 1;
        }
    }

    const userId = message.webhookId ?? message.author.id;

    bumpServerStat(message.guild.id, {
        total: 1,
        [`users.${userId}`]:                1,
        [`channels.${message.channel.id}`]: 1,
        ...wordCounts,
    });

    // Cruzamento user × canal (agregado, prospectivo) — alimenta "canal favorito"
    bumpUserChannel(message.guild.id, userId, message.channel.id);
}

// ─── Tracking de mensagens de webhook (OCs: RPTool / Tupperbox / PluralKit) ────
// Webhooks não entram em trackMessageStats (são "bot"). Aqui contamos o personagem
// pelo nome de exibição da mensagem (username), que é o identificador real de um OC
// — um único webhookId serve vários personagens (caso do Tupperbox).
function sanitizeOCKey(name: string): string {
    // Chaves de Map no Mongo não podem conter '.' nem começar com '$'.
    return (name || 'Desconhecido').replace(/[.$]/g, '').trim().slice(0, 80) || 'Desconhecido';
}

async function trackWebhookStats(message: Message): Promise<void> {
    if (!message.guild) return;

    const ocKey = sanitizeOCKey(message.author.username);

    bumpServerStat(message.guild.id, {
        total: 1,
        [`ocs.${ocKey}`]:                   1,
        [`channels.${message.channel.id}`]: 1,
    });
}

// ─── Handler central registrado no EventCheckout ──────────────────────────────
EventCheckout.onMessageCreate('__system.checkout', async (message: Message) => {
    await initRoutines(message.client as Client);

    if (message.webhookId) {
        // Mensagem de OC (RPTool/Tupperbox/PluralKit/...) → contabiliza por personagem
        trackWebhookStats(message).catch(() => null);
    } else if (!message.author.bot) {
        // Humano → estatísticas normais (users/channels/words)
        trackMessageStats(message).catch(() => null);
    }
    // Outros bots (sem webhookId) são ignorados.

    return false; // não consome — outros handlers continuam
});

export default async function runSystemChecks(message: Message, _client: Client): Promise<boolean> {
    // O processamento agora ocorre via EventCheckout.dispatch internamente.
    // Retorna false para que o index.ts continue com o roteamento de comandos.
    return false;
}