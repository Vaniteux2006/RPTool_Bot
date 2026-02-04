import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    Message, 
    SlashCommandOptionsOnlyBuilder 
} from 'discord.js';

export interface Command {
    name: string;
    description: string;
    aliases?: string[];
    data?: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    executeSlash?: (interaction: ChatInputCommandInteraction) => Promise<void>;
    execute: (message: Message | any, args: string[]) => Promise<void>; // 'any' no message para compatibilidade com o fakeMessage do ai.ts
}