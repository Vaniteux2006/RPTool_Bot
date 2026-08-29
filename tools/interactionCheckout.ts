import { Client, Interaction } from 'discord.js';
import { handleFutebolInteraction } from '../supercommands/futebol/interactions';
import { handleFichaInteraction }   from '../supercommands/ficha/interactions';
import { handleStatusInteraction }  from '../supercommands/status/interactions';
import { handleTokenInteraction }   from '../supercommands/token/interactions';
import { handleChessInteraction }   from '../supercommands/chess/interactions';

export default async function runInteractionChecks(interaction: Interaction, client: Client): Promise<boolean> {

    // ── Ficha: botões (aprovar/rejeitar) e modais (motivo de rejeição) ──
    if (
        (interaction.isButton()      && interaction.customId.startsWith('ficha_')) ||
        (interaction.isModalSubmit() && interaction.customId.startsWith('ficha_'))
    ) {
        await handleFichaInteraction(interaction);
        return true;
    }

    // ── Status: rankings paginados (botões) e modal de data ──
    if (
        (interaction.isButton()      && interaction.customId.startsWith('stats_')) ||
        (interaction.isModalSubmit() && interaction.customId.startsWith('stats_'))
    ) {
        await handleStatusInteraction(interaction);
        return true;
    }

    // ── Token: painel de chaves de IA (botões, selects e modais) ──
    if (
        (interaction.isButton()           && interaction.customId.startsWith('token_')) ||
        (interaction.isStringSelectMenu() && interaction.customId.startsWith('token_')) ||
        (interaction.isModalSubmit()      && interaction.customId.startsWith('token_'))
    ) {
        await handleTokenInteraction(interaction);
        return true;
    }

    // ── Xadrez: convites, dificuldade, lances (botões + modal) ──
    if (
        (interaction.isButton()      && interaction.customId.startsWith('chess_')) ||
        (interaction.isModalSubmit() && interaction.customId.startsWith('chess_'))
    ) {
        await handleChessInteraction(interaction);
        return true;
    }

    // ── Futebol: botões E select menus (fb_round_select, fb_apply_tactic, etc) ──
    // IDs gerenciados por collectors locais (fb_list_*, fb_irl_*, fb_halftime_*)
    // são ignorados dentro do handler para não responder em duplicidade.
    if (
        (interaction.isButton()           && interaction.customId.startsWith('fb_')) ||
        (interaction.isStringSelectMenu() && interaction.customId.startsWith('fb_'))
    ) {
        await handleFutebolInteraction(interaction);
    }

    return false;
}