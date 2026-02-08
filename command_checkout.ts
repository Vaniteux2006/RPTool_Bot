import { Message, Client } from 'discord.js';
import phoneCommand from './commands/phone';
import rollCommand from './commands/roll';
import timeCommand from './commands/time';
import command42 from './commands/42';

// IMPORTS NOVOS DAS FUNÇÕES ESPECÍFICAS
import { handleTupperMessage } from './commands/webhook'; 
import { handleAIMessage } from './commands/tul'; 

let clocksInitialized = false;

export default async function runSystemChecks(message: Message, client: Client): Promise<boolean> {
    if (message.author.bot) return false;

    // 0. Inicialização de Relógios (Mantido igual)
    if (!clocksInitialized) {
        console.log("🛠️ Checkout acionado: Verificando relógios persistentes...");
        await timeCommand.checkAndRestoreClocks(client);
        clocksInitialized = true; 
    }

    // 1. SISTEMA TUL (IA / Insert)
    // Verifica se tem um tupper com IA ativo neste canal e responde
    // Se a IA responder, a gente retorna true pra não processar mais nada
    if (await handleAIMessage(message)) return true;
    
    // 2. Comandos Especiais (42)
    if (await command42.processMessage(message)) return true;

    // 3. Webhook / Tuppers Automáticos (Brackets Manuais: k!oi)
    // Essa função já verifica prefixo, banco de dados e envia o webhook
    await handleTupperMessage(message); 
    // Nota: handleTupperMessage não retorna boolean de "stop", ele executa e pronto.
    // Mas se ele executou (deletou a msg original), o fluxo do Discord já muda.

    // 4. Telefone
    if (await phoneCommand.processPhoneMessage(message)) return true;

    // 5. Dados (ex: 1d20)
    if (await rollCommand.processRoll(message, message.content)) return true;

    return false;
};