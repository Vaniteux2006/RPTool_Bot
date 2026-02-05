import { Message, Client } from 'discord.js';
import phoneCommand from './commands/phone';
import rollCommand from './commands/roll';
import webhookCommand from './commands/webhook';
import tulCommand from './commands/tul'; // Importa o novo sistema TUL
import timeCommand from './commands/time';

let clocksInitialized = false;

export default async function runSystemChecks(message: Message, client: Client): Promise<boolean> {
    if (message.author.bot) return false;

    if (!clocksInitialized) {
        console.log("🛠️ Checkout acionado: Verificando relógios persistentes...");
        await timeCommand.checkAndRestoreClocks(client);
        clocksInitialized = true; // Marca como feito para não repetir
    }
    // 1. SISTEMA TUL (Logger de IA)
    // O tul.ts verifica internamente se tem sessão ativa no canal e guarda o contexto
    tulCommand.onMessage(message);

    // 2. Webhook / Tuppers Automáticos (Brackets Manuais)
    if (await webhookCommand.processMessage(message, client)) return true;

    // 3. Telefone
    if (await phoneCommand.processPhoneMessage(message)) return true;

    // 4. Dados (ex: 1d20)
    if (await rollCommand.processRoll(message, message.content)) return true;

    // 5. Quotes (se necessário no futuro)
    // if (await quoteCommand.check(message)) return true;

    return false;
};