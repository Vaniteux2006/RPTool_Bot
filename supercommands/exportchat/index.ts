// RPTool/supercommands/exportchat/index.ts
// ─── Exportação de Chat para HTML ─────────────────────────────────────────────
// Importa a geração de HTML de HtmlTranscript.ts (compartilhado com Messagelogs).
// A lógica de busca de mensagens, confirmação e envio por DM permanece aqui.

import {
    Message,
    TextChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    AttachmentBuilder,
} from 'discord.js';

// ── Importa geração de HTML do utilitário compartilhado ───────────────────────
import { buildChunks, htmlHeader, HTML_FOOTER } from '../../tools/HtmlTranscript';

// ─── Utilitários de Data / Snowflake ─────────────────────────────────────────

function dateToSnowflake(date: Date): string {
    const DISCORD_EPOCH = 1420070400000n;
    return ((BigInt(date.getTime()) - DISCORD_EPOCH) << 22n).toString();
}

interface TimeRange { start: Date; end: Date; }

function parseTimeRange(raw: string): TimeRange | null {
    const arrowIdx = raw.indexOf('->');
    if (arrowIdx === -1) return null;

    const leftStr  = raw.slice(0, arrowIdx).trim();
    const rightStr = raw.slice(arrowIdx + 2).trim();

    const parseOne = (s: string): Date | null => {
        const now = new Date();

        let m = s.match(/^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (m) {
            const year = m[5].length === 2 ? 2000 + +m[5] : +m[5];
            return new Date(year, +m[4] - 1, +m[3], +m[1], +m[2], 0, 0);
        }
        m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (m) {
            const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
            const isEnd = s === rightStr;
            return new Date(year, +m[2] - 1, +m[1], isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, 0);
        }
        m = s.match(/^(\d{1,2}):(\d{2})$/);
        if (m) {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2], 0, 0);
        }
        return null;
    };

    const start = parseOne(leftStr);
    const end   = parseOne(rightStr);
    if (!start || !end) return null;

    if (end <= start) {
        if (!leftStr.includes('/') && !rightStr.includes('/')) {
            end.setDate(end.getDate() + 1);
        } else {
            return null;
        }
    }
    return { start, end };
}

// ─── Estado de cancelamento ───────────────────────────────────────────────────
const activeExports = new Map<string, boolean>();

// ─── Comando ──────────────────────────────────────────────────────────────────
export default {
    name: 'exportchat',
    description: 'Exporta mensagens de um canal por intervalo de data/hora para HTML.',
    aliases: ['exportar', 'backupchat'],

    async execute(message: Message, args: string[]) {
        const commandChannel = message.channel as TextChannel;

        // ── 1. Parsear canal ──────────────────────────────────────────────────
        if (!args.length) {
            return message.reply(
                '❌ Uso: `rp!exportchat #canal` (histórico completo)\n' +
                'Ou com intervalo: `rp!exportchat #canal HH:MM -> HH:MM`\n' +
                'Formatos aceitos: `DD/MM/AAAA -> DD/MM/AAAA` | `HH:MM DD/MM/AAAA -> HH:MM DD/MM/AAAA`',
            );
        }

        const channelId     = args[0].replace(/\D/g, '');
        const targetChannel = message.guild?.channels.cache.get(channelId) as TextChannel | undefined;
        if (!targetChannel?.isTextBased()) {
            return message.reply('❌ Canal inválido! Mencione um canal de texto com #.');
        }

        // ── 2. Parsear intervalo (opcional) ───────────────────────────────────
        const rangeStr = args.slice(1).join(' ').trim();
        let range: TimeRange | null = null;

        if (rangeStr.includes('->')) {
            range = parseTimeRange(rangeStr);
            if (!range) {
                return message.reply(
                    '❌ Intervalo inválido! Exemplos válidos:\n' +
                    '• `14:00 -> 18:30`\n' +
                    '• `01/06/2024 -> 30/06/2024`\n' +
                    '• `09:00 01/06/2024 -> 18:00 30/06/2024`',
                );
            }
        }

        // ── 3. Buscar mensagens ───────────────────────────────────────────────
        const statusMsg = await message.reply(
            range
                ? `⏳ Buscando mensagens em <#${targetChannel.id}> de **${range.start.toLocaleString('pt-BR')}** até **${range.end.toLocaleString('pt-BR')}**...`
                : `⏳ Buscando **todo o histórico** de <#${targetChannel.id}>...`,
        );

        const allMessages: Message[] = [];
        let afterId = range ? dateToSnowflake(new Date(range.start.getTime() - 1)) : '0';

        try {
            while (true) {
                const fetched = await (targetChannel as TextChannel).messages.fetch({ limit: 100, after: afterId });
                if (fetched.size === 0) break;

                const sorted = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                let passedEnd = false;

                for (const msg of sorted) {
                    if (range && msg.createdTimestamp > range.end.getTime()) { passedEnd = true; break; }
                    if (!range || msg.createdTimestamp >= range.start.getTime()) allMessages.push(msg);
                }

                if (passedEnd) break;
                afterId = sorted[sorted.length - 1].id;
            }
        } catch (err) {
            console.error('[exportchat] Erro ao buscar mensagens:', err);
            return statusMsg.edit('❌ Erro ao buscar mensagens. Verifique as permissões do bot no canal.');
        }

        if (allMessages.length === 0) {
            return statusMsg.edit(
                range ? '❌ Nenhuma mensagem encontrada no intervalo especificado.' : '❌ O canal está vazio!',
            );
        }

        // ── 4. Confirmação se > 10 mensagens ──────────────────────────────────
        const estimatedFiles = Math.ceil(allMessages.length / 1000);

        if (allMessages.length > 10) {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('exp_yes').setLabel('✅ Confirmar').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('exp_no').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
            );

            const confirmMsg = await commandChannel.send({
                content: `<@${message.author.id}> ⚠️ **Atenção**, exportar esse chat precisará de por volta de **${estimatedFiles}** arquivo(s).\nTem certeza?`,
                components: [row],
            });

            try {
                const btn = await confirmMsg.awaitMessageComponent({
                    filter: i => i.user.id === message.author.id && ['exp_yes', 'exp_no'].includes(i.customId),
                    componentType: ComponentType.Button,
                    time: 60_000,
                });
                await btn.deferUpdate();
                if (btn.customId === 'exp_no') {
                    await confirmMsg.edit({ content: '🚫 Exportação cancelada.', components: [] });
                    return;
                }
            } catch {
                await confirmMsg.edit({ content: '⏱️ Tempo esgotado. Exportação cancelada.', components: [] });
                return;
            }

            await confirmMsg.edit({ content: '✅ Confirmado! Iniciando exportação...', components: [] });
        }

        // ── 5. Buscar cores e nomes ────────────────────────────────────────────
        await statusMsg.edit('⏳ Carregando dados dos membros...');

        const colorCache    = new Map<string, string>();
        const nameCache     = new Map<string, string>();
        const mentionedIds  = new Set<string>();
        for (const msg of allMessages) {
            for (const user of msg.mentions.users.values()) mentionedIds.add(user.id);
        }
        const uniqueIds = [...new Set([...allMessages.map(m => m.author.id), ...mentionedIds])];

        for (const uid of uniqueIds) {
            try {
                const member = await message.guild?.members.fetch(uid).catch(() => null);
                if (member) {
                    const hex = member.displayHexColor;
                    colorCache.set(uid, hex === '#000000' ? '#ffffff' : hex);
                    nameCache.set(uid, member.displayName);
                } else {
                    colorCache.set(uid, '#ffffff');
                    const user = message.client.users.cache.get(uid);
                    if (user) nameCache.set(uid, user.username);
                }
            } catch {
                colorCache.set(uid, '#ffffff');
            }
        }

        // ── 6. Construir HTML via HtmlTranscript ───────────────────────────────
        await statusMsg.edit(`⏳ Gerando HTML para **${allMessages.length}** mensagens...`);

        // buildChunks agora vem de HtmlTranscript.ts — mesma lógica, sem duplicação
        const chunks     = buildChunks(allMessages, colorCache, nameCache);
        const totalParts = chunks.length;

        // ── 7. Cancelamento via "rp!export end" ────────────────────────────────
        const exportKey = message.author.id;
        activeExports.set(exportKey, false);

        const cancelCollector = commandChannel.createMessageCollector({
            filter: (m: Message) =>
                m.author.id === message.author.id &&
                m.content.trim().toLowerCase() === 'rp!export end',
            time: 3 * 60 * 60 * 1000,
        });
        cancelCollector.on('collect', () => activeExports.set(exportKey, true));

        // ── 8. Abrir DM e enviar arquivos ──────────────────────────────────────
        let dmChannel;
        try {
            dmChannel = await message.author.createDM();
        } catch {
            return statusMsg.edit('❌ Não consegui abrir seu DM. Verifique se permite mensagens diretas.');
        }

        await statusMsg.edit(`⏳ Iniciando envio de **${totalParts}** arquivo(s) no seu DM. Use \`rp!export end\` para cancelar.`);

        for (let i = 0; i < totalParts; i++) {
            if (activeExports.get(exportKey)) {
                cancelCollector.stop();
                activeExports.delete(exportKey);
                await statusMsg.edit(`🛑 **Encerrado!** (${i}/${totalParts} arquivos enviados)`);
                await dmChannel.send('🛑 **Processo encerrado!**');
                return;
            }

            const chunk      = chunks[i];
            const part       = i + 1;
            const first      = new Date(chunk.messages[0].createdTimestamp).toLocaleString('pt-BR');
            const last       = new Date(chunk.messages[chunk.messages.length - 1].createdTimestamp).toLocaleString('pt-BR');
            const rangeLabel = `${first} → ${last} · ${chunk.messages.length} mensagens`;

            // htmlHeader agora vem de HtmlTranscript.ts
            const fullHtml   = htmlHeader(targetChannel.name, rangeLabel, part, totalParts) +
                               chunk.body + HTML_FOOTER;
            const attachment = new AttachmentBuilder(Buffer.from(fullHtml, 'utf-8'), {
                name: `export_${targetChannel.name}_parte${part}.html`,
            });

            await dmChannel.send({
                content: `📦 **Parte ${part}/${totalParts}** — <#${targetChannel.id}>`,
                files:   [attachment],
            });
        }

        // ── 9. Finalizar ───────────────────────────────────────────────────────
        cancelCollector.stop();
        activeExports.delete(exportKey);
        await statusMsg.edit(`✅ **Exportação concluída!** ${totalParts} arquivo(s) enviados no seu DM.`);
    },
};
