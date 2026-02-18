import { Client, Interaction } from 'discord.js';
import { handleFichaInteraction } from './commands/ficha'; 

export default async function runInteractionChecks(interaction: Interaction, client: Client): Promise<boolean> {
    
    if (interaction.isButton() && interaction.customId.startsWith('ficha_')) {
        await handleFichaInteraction(interaction);
        return true; 
    }

    return false;
}