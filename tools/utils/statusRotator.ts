// tools/utils/statusRotator.ts
// ─── Rotador de status do bot ─────────────────────────────────────────────────
// A cada 15s sorteia uma frase da collection BotStatus (banco) e a exibe como
// atividade do bot. `{version}` na frase vira a versão atual.
//
// Auto-registra no ClientReady via EventCheckout — carregado pelo bloco de
// imports de auto-registro do commandCheckout. O index.ts não conhece este módulo.
import { ActivityType, Client } from 'discord.js';
import { EventCheckout } from '../eventCheckout';
import { BotStatusModel } from '../models/Outros';
import returnVersion from '../returnVersion';

async function updateStatus(client: Client): Promise<void> {
    try {
        const statuses = await BotStatusModel.find({});
        if (statuses.length > 0) {
            const entry = statuses[Math.floor(Math.random() * statuses.length)];
            const text = entry.content.replace('{version}', returnVersion());
            const typeKey = entry.type as keyof typeof ActivityType;
            client.user?.setActivity(text, { type: ActivityType[typeKey] });
        }
    } catch (e) {
        console.error('Erro ao puxar status do banco:', e);
    }
}

EventCheckout.onClientReady('system.statusRotator', async (client) => {
    updateStatus(client);
    setInterval(() => updateStatus(client), 15000);
});
