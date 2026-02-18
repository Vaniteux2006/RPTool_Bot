import { SlashCommandBuilder, ChatInputCommandInteraction, Message, PermissionFlagsBits } from 'discord.js';
import { WelcomeModel } from '../models/Outros';

export default {
    name: 'welcome',
    description: 'Configura o painel de boas-vindas e moderação',
    aliases: ['boasvindas', 'setwelcome', 'registro'],

    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configura o sistema de boas-vindas do servidor')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        await interaction.reply({ content: "Use o comando de texto `rp!welcome` para essa versão avançada!", ephemeral: true });
    },

    async execute(message: Message | any, args: string[]) {
        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Apenas administradores podem configurar a recepção.');
        }

        let action = args[0]?.toLowerCase();
        const guildId = message.guild.id;

        if (action && action.startsWith('<#') && action.endsWith('>')) {
            args.unshift('canal'); 
            action = 'canal';
        }

        let config = await WelcomeModel.findOne({ guildId });
        if (!config) config = new WelcomeModel({ guildId });

        if (action === 'canal') {
            const targetChannel = message.mentions?.channels?.first();
            if (!targetChannel) return message.reply('❌ Mencione o canal! Ex: `rp!welcome #geral`');
            config.channelId = targetChannel.id;
            await config.save();
            return message.reply(`✅ Canal de registros definido para <#${targetChannel.id}>!`);
        }

        if (action === 'end') {
            await WelcomeModel.deleteOne({ guildId });
            return message.reply('🛑 Sistema de registros e boas-vindas totalmente apagado e desligado.');
        }

        if (action === 'change') {
            const type = args[1]?.toLowerCase();
            const validTypes = ['join', 'leave', 'kick', 'ban'];
            
            let targetType = 'join';
            let startIndex = 1;

            if (validTypes.includes(type)) {
                targetType = type;
                startIndex = 2; 
            }

            let newMsg = args.slice(startIndex).join(' ').replace(/^["']|["']$/g, '');
            if (!newMsg) return message.reply('❌ Escreva a mensagem! Ex: `rp!welcome change "Bem-vindo {user}!"`\n*Você também pode especificar o tipo:* `rp!welcome change ban "{user} se fodeu."`');

            if (targetType === 'join') config.joinMsg = newMsg;
            if (targetType === 'leave') config.leaveMsg = newMsg;
            if (targetType === 'kick') config.kickMsg = newMsg;
            if (targetType === 'ban') config.banMsg = newMsg;

            await config.save();
            return message.reply(`✅ Mensagem de **${targetType}** atualizada com sucesso!`);
        }

        return message.reply('👋 **Painel de Registros:**\n\n`rp!welcome #canal` - Define onde enviar\n`rp!welcome change "msg"` - Altera a msg de entrada\n`rp!welcome change <leave/kick/ban> "msg"` - Altera as outras msgs\n`rp!welcome end` - Desliga tudo e reseta\n\n*Variáveis aceitas: `{user}`, `{server}`, `{count}`*');
    }
};