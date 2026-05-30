// RPTool/supercommands/tempo/index.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, Message, Client } from 'discord.js';
import { startClockEngine } from './clockEngine';
import {
    handleCreate,
    handleSet,
    handleSkip,
    handlePause,
    handleDelete,
    handleList,
    handleInfo,
} from './handlers/clock';
import { handleConvert, handleMsgRate } from './handlers/convert';

export default {
    name:        'tempo',
    description: 'Motor de Tempo RP — relógios, velocidade, saltos e conversões',
    aliases:     ['time', 'clock', 'relogio', 'relógio'],

    data: new SlashCommandBuilder()
        .setName('tempo')
        .setDescription('Motor de Tempo RP'),

    // ─── Chamado UMA VEZ ao iniciar o bot (no command_checkout) ───────────────
    async checkAndRestoreClocks(client: Client) {
        await startClockEngine(client);
    },

    async executeSlash(interaction: ChatInputCommandInteraction) {
        return interaction.reply({ content: 'Use `rp!tempo` para ver os comandos disponíveis.', ephemeral: true });
    },

    async execute(message: Message, args: string[]) {
        const action = args[0]?.toLowerCase();

        if (!action) return sendHelp(message);

        try {
            switch (action) {

                // ── Criação simples: rp!tempo #canal [Nome] ───────────────────
                default:
                    if (action.startsWith('<#')) return await handleCreate(message, args);
                    return message.reply(`❌ Subcomando \`${action}\` desconhecido. Use \`rp!tempo\` para ajuda.`);

                // ── Criação/reposicionamento avançado ─────────────────────────
                case 'set':
                    return await handleSet(message, args);

                // ── Controles ─────────────────────────────────────────────────
                case 'skip':
                    return await handleSkip(message, args);

                case 'pause':
                    return await handlePause(message, args, true);

                case 'resume':
                    return await handlePause(message, args, false);

                case 'delete':
                case 'del':
                    return await handleDelete(message, args);

                // ── Consultas ─────────────────────────────────────────────────
                case 'list':
                case 'lista':
                    return await handleList(message);

                case 'info':
                    return await handleInfo(message, args);

                // ── Conversão ─────────────────────────────────────────────────
                case 'conv':
                case 'converter':
                    return await handleConvert(message, args);

                case 'msg':
                case 'mensagens':
                    return await handleMsgRate(message, args);

                // ── Ajuda explícita ────────────────────────────────────────────
                case 'help':
                case 'ajuda':
                    return sendHelp(message);
            }
        } catch (e) {
            console.error(`[Tempo] Erro em "${action}":`, e);
            return message.reply('🚨 Erro interno no motor de tempo. Tente novamente.');
        }
    },
};

function sendHelp(message: Message) {
    return message.reply(
        `🕰️ **Motor de Tempo RP**\n\n` +

        `**🔹 Criação**\n` +
        `\`rp!tempo #canal [Nome]\` — relógio simples (hora real)\n` +
        `\`rp!tempo set <Nome> [#canal] <DD/MM/AAAA> <HH:MM> [+ Xm -> Yh]\`\n` +
        `— relógio RP com data/hora específica e velocidade customizada\n` +
        `> Ex: \`rp!tempo set Seattle 01/01/2005 15:30 + 1m -> 10m\`\n\n` +

        `**🔹 Controles**\n` +
        `\`rp!tempo skip <Nome> <Tempo>\` — avança o tempo RP (ex: \`2h\`, \`3d\`)\n` +
        `\`rp!tempo pause <Nome>\` — congela o relógio\n` +
        `\`rp!tempo resume <Nome>\` — retoma\n` +
        `\`rp!tempo delete <Nome>\` — remove\n\n` +

        `**🔹 Consultas**\n` +
        `\`rp!tempo list\` — todos os relógios ativos no servidor\n` +
        `\`rp!tempo info <Nome>\` — detalhes de um relógio\n\n` +

        `**🔹 Conversão**\n` +
        `\`rp!tempo conv <Nome> <Tempo Real>\` — quanto tempo RP passa em X real\n` +
        `\`rp!tempo conv <Xm -> Yh>\` — converte escala sem relógio\n` +
        `\`rp!tempo msg <Nome> <N> <Duração RP>\` — taxa de tempo por mensagem\n\n` +

        `**🔹 Clima**\n` +
        `Combine com \`rp!clima sync <Nome> <Local>\` para clima automático por localização.`,
    );
}