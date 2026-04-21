// RPTool/supercommands/clima/index.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import {
    handleLookup,
    handleRPQuery,
    handleSync,
    handleForce,
    handleDef,
    handleHistorical,
} from './handlers/weather';

export default {
    name:        'clima',
    description: 'Sistema de Clima RP — vinculado aos relógios do /tempo',
    aliases:     ['weather', 'chuva', 'sol'],

    data: new SlashCommandBuilder()
        .setName('clima')
        .setDescription('Sistema de Clima RP'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        return interaction.reply({ content: 'Use `rp!clima` para ver os comandos disponíveis.', ephemeral: true });
    },

    async execute(message: Message, args: string[]) {
        const action = args[0]?.toLowerCase() ?? '';

        if (!action) return sendHelp(message);

        try {
            // ── rp!clima #canal — consulta RP (canal mencionado) ──────────────
            if (action.startsWith('<#')) {
                const channelId = action.replace(/[<#>]/g, '');
                return await handleRPQuery(message, channelId);
            }

            switch (action) {

                // ── Sincronizar localização com relógio ───────────────────────
                case 'sync':
                case 'local':
                    return await handleSync(message, args);

                // ── Forçar / override climático ───────────────────────────────
                case 'force':
                case 'forçar':
                    return await handleForce(message, args);

                // ── Listar condições padrão ───────────────────────────────────
                case 'def':
                case 'lista':
                case 'padroes':
                case 'padrões':
                    return await handleDef(message);

                // ── Consulta histórica direta ─────────────────────────────────
                case 'historico':
                case 'histórico':
                case 'hist':
                    return await handleHistorical(message, args);

                // ── Ajuda ─────────────────────────────────────────────────────
                case 'help':
                case 'ajuda':
                    return sendHelp(message);

                // ── Lookup direto de qualquer local (tempo real) ──────────────
                // Qualquer outra coisa é tratada como nome de local
                default:
                    return await handleLookup(message, args);
            }
        } catch (e) {
            console.error(`[Clima] Erro em "${action}":`, e);
            return message.reply('🚨 Erro interno no sistema de clima. Tente novamente.');
        }
    },
};

function sendHelp(message: Message) {
    return message.reply(
        `🌦️ **Sistema de Clima RP**\n\n` +

        `**🔹 Consulta Rápida (Tempo Real)**\n` +
        `\`rp!clima <Local>\` — clima atual em qualquer cidade/coordenada\n` +
        `Ex: \`rp!clima Seattle\`, \`rp!clima 47.6N 122.3W\`\n\n` +

        `**🔹 Consulta RP**\n` +
        `\`rp!clima #canal\` — clima no relógio vinculado àquele canal\n` +
        `Usa a data RP atual + localização sincronizada.\n\n` +

        `**🔹 Consulta Histórica**\n` +
        `\`rp!clima historico <Local> <DD/MM/AAAA>\`\n` +
        `Ex: \`rp!clima historico Seattle 15/08/2005\`\n\n` +

        `**🔹 Configuração (ADM)**\n` +
        `\`rp!clima sync <Nome do Relógio> <Local>\` — vincula localização ao relógio\n` +
        `\`rp!clima force <Nome> <Condição>\` — força uma condição no relógio\n` +
        `\`rp!clima force <Nome> auto\` — volta ao clima automático\n` +
        `\`rp!clima def\` — lista todas as condições WMO padrão\n\n` +

        `-# **Dica:** Configure \`rp!tempo set\` para a data/hora RP e \`rp!clima sync\` para o local — o bot cuida do resto.`,
    );
}