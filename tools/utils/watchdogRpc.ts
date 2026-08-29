// RPTool/tools/utils/watchdogRpc.ts
// ─── RPC do Watchdog (consultas sob demanda) ──────────────────────────────────
// O Mongo (DB_STATUS) já é o barramento RPTool ⇄ vigia (ver telemetry.ts) — este
// módulo adiciona o sentido inverso: o vigia INSERE um pedido em
// `watchdog_requests` e o RPTool responde NO MESMO documento:
//
//   vigia:  { cmd: 'guild_members', args: {...}, status: 'pending', ts }
//   RPTool: → status: 'done' + result   (ou status: 'error' + error)
//
// Poll de 2s com claim atômico (findOneAndUpdate pending→processing) — um
// pedido nunca é atendido duas vezes. TTL de 1h limpa a collection sozinho.
// Para expor uma consulta nova ao vigia, basta adicionar uma entrada em HANDLERS.
// O cliente do outro lado é o RPTool-Watchdog/tools/rpc.ts.
//
// Auto-registra no ClientReady via EventCheckout — importado pelo bloco de
// auto-registro do commandCheckout. Sem DB_STATUS no .env, desativa-se sozinho.
import mongoose from 'mongoose';
import { getConnection } from '../database';
import { Client } from 'discord.js';
import { EventCheckout } from '../eventCheckout';

const uri = process.env.DB_STATUS;

let RequestModel: mongoose.Model<any> | null = null;

if (uri) {
    const conn = getConnection(uri, 'Status');
    conn.on('error', (err) => console.error('❌ [WatchdogRPC] Erro na conexão DB_STATUS:', err));

    const schema = new mongoose.Schema(
        { ts: Date },
        { strict: false, collection: 'watchdog_requests', versionKey: false });
    schema.index({ ts: 1 }, { expireAfterSeconds: 3600 });
    RequestModel = conn.model('WatchdogRequest', schema);
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
// Cada handler recebe (client, args) e devolve o `result` gravado na resposta.
// Lançar um Error vira { status: 'error', error: mensagem } para o vigia exibir.
type Handler = (client: Client, args: any) => Promise<any>;

const HANDLERS: Record<string, Handler> = {
    // Teste de vida do canal RPC (wd! nenhum usa ainda — útil pra depurar)
    async ping(client) {
        return {
            pong: true,
            guilds: client.guilds.cache.size,
            uptimeSec: Math.round(process.uptime()),
        };
    },

    // Membros de um servidor — fetch ao vivo pelo gateway (intent GuildMembers)
    async guild_members(client, args) {
        const guild = client.guilds.cache.get(String(args?.guildId ?? ''));
        if (!guild) throw new Error('RPTool não está num servidor com esse id.');

        const members = await guild.members.fetch();
        const MAX = 50_000; // a resposta é 1 doc Mongo (teto 16 MB) — trunca bem antes
        const list = [...members.values()].slice(0, MAX).map(m => ({
            id:       m.id,
            tag:      m.user.tag,
            nick:     m.nickname ?? null,
            bot:      m.user.bot,
            joinedAt: m.joinedTimestamp,
        }));
        return {
            guildId:   guild.id,
            guildName: guild.name,
            total:     guild.memberCount,
            truncated: members.size > MAX,
            list,
        };
    },
};

// ─── Loop de atendimento ──────────────────────────────────────────────────────
let running = false;

async function processPending(client: Client): Promise<void> {
    if (running || !RequestModel) return;   // um fetch grande pode passar de 2s — não sobrepõe
    running = true;
    try {
        for (;;) {
            // Claim atômico: marca como processing no mesmo passo em que pega.
            const req = await RequestModel.findOneAndUpdate(
                { status: 'pending' },
                { $set: { status: 'processing', claimedAt: new Date() } },
                { new: true },
            );
            if (!req) return;

            const cmd = String(req.get('cmd') ?? '');
            try {
                const handler = HANDLERS[cmd];
                if (!handler) throw new Error(`cmd desconhecido: "${cmd}"`);
                const result = await handler(client, req.get('args') ?? {});
                await RequestModel.updateOne(
                    { _id: req._id },
                    { $set: { status: 'done', result, doneAt: new Date() } });
            } catch (err: any) {
                await RequestModel.updateOne(
                    { _id: req._id },
                    { $set: { status: 'error', error: String(err?.message ?? err), doneAt: new Date() } });
            }
        }
    } catch (err) {
        console.error('[WatchdogRPC] Loop de atendimento falhou:', err);
    } finally {
        running = false;
    }
}

if (uri) {
    EventCheckout.onClientReady('system.watchdogRpc', async (client) => {
        const timer = setInterval(() => void processPending(client), 2000);
        timer.unref();
        console.log('📨 [WatchdogRPC] Atendendo pedidos do vigia (watchdog_requests).');
    });
}
