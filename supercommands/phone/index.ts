// RPTool/supercommands/phone/index.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { phoneSystem } from './system';

// Importando os handlers
import handleRegister from './handlers/register';
import handleOff from './handlers/off';
import handleCall from './handlers/call';
import handleAccept from './handlers/accept';
import handleDecline from './handlers/decline';
import handleEnd from './handlers/end';

export default {
    name: 'phone',
    description: 'Sistema de Telefone Inter-Servidores',
    
    data: new SlashCommandBuilder()
        .setName('phone')
        .setDescription('Telefone Inter-Servidores')
        .addSubcommand(sub => sub.setName('call').setDescription('Liga para um servidor').addStringOption(op => op.setName('alvo').setDescription('ID ou Nome do servidor').setRequired(true)))
        .addSubcommand(sub => sub.setName('register').setDescription('Instala o telefone neste canal').addStringOption(op => op.setName('nome').setDescription('Nome público do local').setRequired(false)))
        .addSubcommand(sub => sub.setName('accept').setDescription('Atende uma chamada'))
        .addSubcommand(sub => sub.setName('decline').setDescription('Recusa uma chamada'))
        .addSubcommand(sub => sub.setName('end').setDescription('Desliga a chamada')),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const args = [sub]; 
        const alvo = interaction.options.getString('alvo') || interaction.options.getString('nome');
        if (alvo) args.push(alvo); 

        const fakeMessage: any = {
            content: `rp!phone ${args.join(' ')}`, 
            author: interaction.user, 
            guild: interaction.guild,
            channel: interaction.channel, 
            client: interaction.client, 
            reply: async (payload: any) => interaction.replied || interaction.deferred ? interaction.followUp(payload) : interaction.reply(payload)
        };
        
        await this.execute(fakeMessage, args);
    },

    async execute(message: Message | any, args: string[]) {
        await phoneSystem.init();

        const action = args[0] ? args[0].toLowerCase() : null;

        if (!action) {
            return message.reply("📱 **Telefone:** Use `register, call, accept, decline, end`.");
        }

        try {
            switch (action) {
                case 'register': await handleRegister(message, args); break;
                case 'off': await handleOff(message); break;
                case 'call': await handleCall(message, args); break;
                case 'accept': await handleAccept(message); break;
                case 'decline': await handleDecline(message); break;
                case 'end': await handleEnd(message); break;
                default: message.reply("📱 **Telefone:** Use `register, call, accept, decline, end`."); break;
            }
        } catch (e) {
            console.error(e);
            message.reply("❌ HTTP 418: I'm a teapot");
        }
    },

    async processMessage(message: Message) {
        return await phoneSystem.processPhoneMessage(message);
    }
};