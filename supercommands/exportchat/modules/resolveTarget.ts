// RPTool/supercommands/exportchat/modules/resolveTarget.ts
// ─── Resolução do canal alvo (funciona no servidor E no PV) ──────────────────
//
// No servidor o alvo vem de uma menção (#canal). No PV não existe menção de
// canal, então o usuário passa o ID ou o link ("Copiar link" no menu do canal).
//
// ⚠️ É AQUI que mora a checagem de acesso. Sem ela, exportar por ID no PV seria
// um vazamento: qualquer pessoa pediria o histórico de qualquer canal de
// qualquer servidor onde o bot está. A regra é simples — o usuário só exporta o
// que ele mesmo consegue ler. Vale para o PV e para o servidor (onde antes dava
// pra exportar por ID um canal que você não enxerga).

import { GuildTextBasedChannel, Message, PermissionFlagsBits } from 'discord.js';

export interface AlvoExport {
    canal?: GuildTextBasedChannel;
    erro?: string;
}

// ViewChannel sozinho não basta: dá pra ver o canal e não poder ler o histórico.
const PERMS_LEITURA = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];

// Aceita <#123>, 123 e https://discord.com/channels/<guild>/<canal>[/<mensagem>].
// O replace(/\D/g) genérico NÃO serve para link (grudaria os três números num só).
export function extrairIdCanal(bruto: string): string | null {
    if (!bruto) return null;

    const link = bruto.match(/channels\/(?:\d+|@me)\/(\d+)/);
    if (link) return link[1];

    const mencao = bruto.match(/^<#(\d+)>$/);
    if (mencao) return mencao[1];

    const cru = bruto.replace(/\D/g, '');
    return cru || null;
}

export async function resolveTarget(message: Message, bruto: string): Promise<AlvoExport> {
    const id = extrairIdCanal(bruto);
    if (!id) {
        return {
            erro: message.guild
                ? '❌ Canal inválido! Mencione um canal de texto ou tópico com #.'
                : '❌ Canal inválido! No PV, mande o **link** ou o **ID** do canal (botão direito no canal → Copiar link). Uma menção `<#id>` copiada de um servidor também serve.',
        };
    }

    // Tópicos (threads) não ficam em guild.channels.cache — o cache global do
    // client resolve, e o fetch cobre tópico arquivado fora do cache.
    const canal = message.client.channels.cache.get(id)
        ?? await message.client.channels.fetch(id).catch(() => null);

    if (!canal || canal.isDMBased() || !canal.isTextBased()) {
        return { erro: '❌ Não achei esse canal (ou não é um canal de texto/tópico de servidor).' };
    }

    const alvo = canal as GuildTextBasedChannel;

    // No servidor, a regra antiga continua: não exportar canal de outro servidor.
    if (message.guild && alvo.guildId !== message.guild.id) {
        return { erro: '❌ Esse canal é de outro servidor. Rode o comando lá dentro — ou aqui no meu PV, passando o link.' };
    }

    const membro = await alvo.guild.members.fetch(message.author.id).catch(() => null);
    if (!membro) {
        return { erro: `❌ Você não está em **${alvo.guild.name}** — não dá pra exportar um canal de um servidor que você não participa.` };
    }

    if (!alvo.permissionsFor(membro)?.has(PERMS_LEITURA)) {
        return { erro: '❌ Você não tem permissão de ler esse canal. O export só entrega o que você mesmo consegue ver.' };
    }

    const eu = alvo.guild.members.me;
    if (!eu || !alvo.permissionsFor(eu)?.has(PERMS_LEITURA)) {
        return { erro: '❌ Eu não consigo ler esse canal (falta permissão de Ver Canal / Ler Histórico pro bot).' };
    }

    return { canal: alvo };
}
