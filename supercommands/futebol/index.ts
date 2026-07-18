import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import handleMatch                          from './handlers/match';
import { handleExport, handleImport }       from './handlers/io';
import {
    handleCreateTeam,
    handleAddPlayer,
    handleDeleteTeam,
    handleViewSquad,
    handleAISquad,
    handleSuggestTactics,
    handleSetEmoji,
    handleSetGlobal,
    handleList,
}                                           from './handlers/team';
import { handleTactics }                    from './handlers/tactics';
import {
    handleRoundSim,
    handleRoundNext,
    handleRoundView,
}                                           from './handlers/round';
import {
    handleTourneyCreate,
    handleJoinTourney,
    handleTourneyStart,
    handleTourneyView,
    handleStandings,
}                                           from './handlers/league';
import { handlePunish, handleBan, handlePostpone, handleResume } from './handlers/admin';
import { handleHistory }                    from './handlers/history';
import { handlePlayerRouter }               from './handlers/player';
import { FUTEBOL_HELP_PAGES }               from './helpText';

export default {
    name:        'futebol',
    description: 'Motor de Simulação Tática de Futebol — RPTool ⚽',
    aliases:     ['fb', 'fut', 'football'],

    data: new SlashCommandBuilder()
        .setName('futebol')
        .setDescription('Comandos de futebol do RPTool'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        return interaction.reply({ content: 'Use `rp!futebol` para ver o painel completo.', ephemeral: true });
    },

    async execute(message: Message, args: string[]) {
        const action = args[0]?.toLowerCase();

        // Sem argumentos OU chamado pelo alias raiz (rp!fb, rp!fut, rp!football sem subcomando)
        if (!action) return sendHelp(message);

        try {
            switch (action) {

                // ── Partida ───────────────────────────────────────────────────
                case 'match':
                    return await handleMatch(message, args);

                // ── Gestão de Clube ───────────────────────────────────────────
                case 'create':
                    return await handleCreateTeam(message, args, message.author.id);

                case 'add':
                    // rp!futebol add "Nome" [OVR] [emoji] -ai
                    if (args.includes('-ai')) return await handleAISquad(message, args, message.author.id);
                    return message.reply(
                        '⚠️ A flag `-ai` é necessária para gerar um elenco automaticamente.\n' +
                        'Use `rp!futebol add "Nome" -ai` para gerar 22 jogadores via IA.\n' +
                        '> Você quis dizer **`rp!futebol create`** (para criar um clube do zero)?',
                    );

                case 'addplayer':
                    return await handleAddPlayer(message, args, message.author.id);

                case 'player':
                    return await handlePlayerRouter(message, args, message.author.id);

                case 'delete':
                    return await handleDeleteTeam(message, args, message.author.id);

                case 'squad':
                    return await handleViewSquad(message, args);

                case 'tatic':
                case 'tactic':
                    return await handleTactics(message, args, message.author.id);

                case 'suggest':
                    return await handleSuggestTactics(message, args, message.author.id);

                case 'emoji':
                    return await handleSetEmoji(message, args, message.author.id);

                case 'global':
                    return await handleSetGlobal(message, args, message.author.id);

                // ── Listagens (sugestão 1) ────────────────────────────────────
                case 'list':
                    return await handleList(message, args);

                // ── Torneios ──────────────────────────────────────────────────
                case 'tourney':
                    return await handleTourneyRouter(message, args);

                case 'join':
                    return await handleJoinTourney(message, args, message.author.id);

                case 'standings':
                case 'tabela':
                    return await handleStandings(message, args);

                // ── Rodadas ───────────────────────────────────────────────────
                case 'round':
                    return await handleRoundRouter(message, args);

                // ── Admin / STJD ──────────────────────────────────────────────
                case 'admin':
                    return await handleAdminRouter(message, args);

                // ── I/O ───────────────────────────────────────────────────────
                case 'export':
                    return await handleExport(message, args);

                case 'import':
                    return await handleImport(message);

                // ── Histórico ─────────────────────────────────────────────────
                case 'history':
                case 'historico':
                    return await handleHistory(message, args);

                default:
                    return message.reply(`❌ Subcomando \`${action}\` desconhecido. Use \`rp!futebol\` para ver a lista.`);
            }
        } catch (e) {
            console.error(`[Futebol] Erro em "${action}":`, e);
            return message.reply('🚨 Erro interno no motor de simulação. Tente novamente.');
        }
    },
};

// ─── Roteadores internos ──────────────────────────────────────────────────────
async function handleTourneyRouter(message: Message, args: string[]) {
    switch (args[1]?.toLowerCase()) {
        case 'create': return await handleTourneyCreate(message, args);
        case 'start':  return await handleTourneyStart(message, args);
        case 'view':
        case 'info':
        case 'status': return await handleTourneyView(message, args);
        default: return message.reply('⚠️ **Subcomandos:** `tourney create`, `tourney start`, `tourney view`');
    }
}

async function handleRoundRouter(message: Message, args: string[]) {
    switch (args[1]?.toLowerCase()) {
        case 'sim':  return await handleRoundSim(message, args);
        case 'next': return await handleRoundNext(message, args);
        case 'view': return await handleRoundView(message, args);
        default: return message.reply('⚠️ **Subcomandos:** `round sim`, `round next`, `round view`');
    }
}

async function handleAdminRouter(message: Message, args: string[]) {
    switch (args[1]?.toLowerCase()) {
        case 'punish':   return await handlePunish(message, args);
        case 'ban':      return await handleBan(message, args);
        case 'postpone': return await handlePostpone(message, args);
        case 'resume':   return await handleResume(message, args);
        default: return message.reply('⚠️ **Subcomandos:** `admin punish`, `admin ban`, `admin postpone`, `admin resume`');
    }
}

// ─── Painel de Ajuda ──────────────────────────────────────────────────────────
// O painel ultrapassa o limite de 2000 caracteres do Discord, então é enviado
// em páginas (ver helpText.ts).
async function sendHelp(message: Message) {
    let last;
    for (const page of FUTEBOL_HELP_PAGES) {
        last = await message.reply(page);
    }
    return last;
}