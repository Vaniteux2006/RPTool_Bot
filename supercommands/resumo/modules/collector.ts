// RPTool/supercommands/resumo/modules/collector.ts
// ─── Coleta e fatiamento do log ──────────────────────────────────────────────
// 1. coletarMensagens → varre o canal de trás pra frente até sair do intervalo
// 2. montarBlocos     → fatia por CARACTERES (não por contagem de mensagens)
import { Message, TextChannel } from 'discord.js';
import { MAX_CHARS_POR_BLOCO, MAX_MENSAGENS } from '../config';
import { dateToSnowflake } from './parseArgs';

export interface Coleta {
    mensagens: Message[];
    atingiuTeto: boolean;
}

export interface Blocos {
    chunks: Message[][];
    logs: string[];
    blocoUnico: boolean;
}

// Filtra o que não é RP: comandos rp!, mensagens de bot e vazias. Webhook entra
// sempre — é assim que fala o proxy de OC (RPTool/Tupperbox/PluralKit).
function ehMensagemDeRP(msg: Message): boolean {
    if (msg.webhookId) return true;
    return !msg.content.startsWith('rp!') && !msg.author.bot && msg.content.trim() !== '';
}

export async function coletarMensagens(canal: TextChannel, inicio: Date, fim: Date): Promise<Coleta> {
    const inicioSnowflake = dateToSnowflake(inicio);
    const mensagens: Message[] = [];
    let lastId: string | undefined = dateToSnowflake(fim);
    let continuar = true;

    while (continuar && mensagens.length < MAX_MENSAGENS) {
        const lote = await canal.messages.fetch({ limit: 100, before: lastId });
        if (lote.size === 0) break;

        for (const [id, msg] of lote) {
            if (BigInt(id) < BigInt(inicioSnowflake)) { continuar = false; break; }
            if (ehMensagemDeRP(msg)) mensagens.push(msg);
        }
        lastId = lote.last()?.id;
    }

    mensagens.reverse();

    // Bateu no teto: o período pedido é maior do que foi lido. Antes isso era
    // silencioso; agora o usuário sabe que o resumo é parcial.
    return { mensagens, atingiuTeto: mensagens.length >= MAX_MENSAGENS };
}

// Fatiamento por caracteres: o modelo tem contexto de sobra, o gargalo é
// requisição/dia. Na prática isto resulta em um bloco só — 1 requisição por resumo.
export function montarBlocos(mensagens: Message[]): Blocos {
    const linhas = mensagens.map(m => {
        const hora = m.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `[${hora}] ${m.author.username}: ${m.content}`;
    });

    const chunks: Message[][] = [];
    const logs: string[] = [];
    let blocoAtual: Message[] = [];
    let linhasAtuais: string[] = [];
    let tamanhoAtual = 0;

    for (let i = 0; i < mensagens.length; i++) {
        const linha = linhas[i];
        if (blocoAtual.length > 0 && tamanhoAtual + linha.length + 1 > MAX_CHARS_POR_BLOCO) {
            chunks.push(blocoAtual);
            logs.push(linhasAtuais.join('\n'));
            blocoAtual = [];
            linhasAtuais = [];
            tamanhoAtual = 0;
        }
        blocoAtual.push(mensagens[i]);
        linhasAtuais.push(linha);
        tamanhoAtual += linha.length + 1;
    }
    if (blocoAtual.length > 0) {
        chunks.push(blocoAtual);
        logs.push(linhasAtuais.join('\n'));
    }

    return { chunks, logs, blocoUnico: chunks.length === 1 };
}
