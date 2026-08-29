// tools/utils/statusRotator.ts
// ─── Rotador de status do bot ─────────────────────────────────────────────────
// A cada 15s consulta o modo em BotStatusConfig:
//   rotate (padrão) → sorteia uma frase da collection BotStatus
//   fixed           → congela em content/type do doc de config (o rodízio
//                     continua salvo, só não é usado)
// `{version}` na frase vira a versão atual. Gerenciável pelo Watchdog.
//
// Auto-registra no ClientReady via EventCheckout — carregado pelo bloco de
// imports de auto-registro do commandCheckout. O index.ts não conhece este módulo.
import { ActivityType, Client } from 'discord.js';
import { EventCheckout } from '../eventCheckout';
import { BotStatusModel, BotStatusConfigModel } from '../models/Outros';
import returnVersion from '../returnVersion';

function apply(client: Client, content: string, type: string): void {
    const text = content.replace('{version}', returnVersion());
    const typeKey = type as keyof typeof ActivityType;
    client.user?.setActivity(text, { type: ActivityType[typeKey] ?? ActivityType.Playing });
}

async function updateStatus(client: Client): Promise<void> {
    try {
        const cfg = await BotStatusConfigModel.findOne({ key: 'main' });
        if (cfg?.mode === 'fixed' && cfg.content) {
            apply(client, cfg.content, cfg.type ?? 'Playing');
            return;
        }

        const statuses = await BotStatusModel.find({});
        if (statuses.length > 0) {
            const entry = statuses[Math.floor(Math.random() * statuses.length)];
            apply(client, entry.content, entry.type);
        }
    } catch (e) {
        console.error('Erro ao puxar status do banco:', e);
    }
}

EventCheckout.onClientReady('system.statusRotator', async (client) => {
    updateStatus(client);
    setInterval(() => updateStatus(client), 15000);
});
