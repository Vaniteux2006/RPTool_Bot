import { Client, Interaction } from 'discord.js';
import { handleFichaInteraction } from '../supercommands/ficha/interactions';
import { handleFutebolInteraction } from '../supercommands/futebol/interactions';

export default async function runInteractionChecks(interaction: Interaction, client: Client): Promise<boolean> {
    
    if (interaction.isButton() && interaction.customId.startsWith('ficha_')) {
        await handleFichaInteraction(interaction);
        return true; 
    }
// dentro do handler de interações:
    if (interaction.isButton() && interaction.customId.startsWith('fb_')) await handleFutebolInteraction(interaction as any);

    return false;
}