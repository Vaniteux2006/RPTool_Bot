// RPTool/supercommands/phone/index.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { phoneSystem } from './system';

// Importando os handlers (Os Estados Balcânicos do Telefone)
import handleRegister from './handlers/register';
import handleOff from './handlers/off';
import handleCall from './handlers/call';
import handleAccept from './handlers/accept';
import handleDecline from './handlers/decline';
import handleEnd from './handlers/end';

export default {
    name: 'phone',
    description: 'Sistema de Telefone Inter-Servidores',
    
    // Mantendo a sua estrutura de Slash Commands perfeitamente intacta
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

        // O seu truque genial de simular uma mensagem para o execute
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
        // Acorda o motor do telefone antes de qualquer coisa
        await phoneSystem.init();

        const action = args[0] ? args[0].toLowerCase() : null;

        if (!action) {
            return message.reply("📱 **Telefone:** Use `register, call, accept, decline, end` ou `off` para desinstalar.");
        }

        switch (action) {
            case 'register': return handleRegister(message, args);
            case 'off': return handleOff(message);
            case 'call': return handleCall(message, args);
            case 'accept': return handleAccept(message);
            case 'decline': return handleDecline(message);
            case 'end': return handleEnd(message);
            default: return message.reply("❌ Comando inválido. HTTP 418: I'm a teapot 🍵");
        }
    },

    // A ponte que o evento client.on vai usar para checar as mensagens normais
    async processMessage(message: Message) {
        return await phoneSystem.processPhoneMessage(message);
    }
};