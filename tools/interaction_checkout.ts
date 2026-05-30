import { Client, Interaction } from 'discord.js';
import { handleFutebolInteraction } from '../supercommands/futebol/interactions';
import { handleFichaInteraction }   from '../supercommands/ficha/interactions';

export default async function runInteractionChecks(interaction: Interaction, client: Client): Promise<boolean> {

    // ── Ficha: botões (aprovar/rejeitar) e modais (motivo de rejeição) ──
    if (
        (interaction.isButton()      && interaction.customId.startsWith('ficha_')) ||
        (interaction.isModalSubmit() && interaction.customId.startsWith('ficha_'))
    ) {
        await handleFichaInteraction(interaction);
        return true;
    }

    // ── Futebol ──
    if (interaction.isButton() && interaction.customId.startsWith('fb_')) {
        await handleFutebolInteraction(interaction as any);
    }

    return false;
}