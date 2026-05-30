"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Outros_1 = require("../models/Outros");
exports.default = {
    name: 'welcome',
    description: 'Configura o painel de boas-vindas e moderação',
    aliases: ['boasvindas', 'setwelcome', 'registro'],
    data: new discord_js_1.SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configura o sistema de boas-vindas do servidor')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator),
    async executeSlash(interaction) {
        await interaction.reply({ content: "Use o comando de texto `rp!welcome` para essa versão avançada!", ephemeral: true });
    },
    async execute(message, args) {
        if (!message.member?.permissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Apenas administradores podem configurar a recepção.');
        }
        let action = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        if (action && action.startsWith('<#') && action.endsWith('>')) {
            args.unshift('canal');
            action = 'canal';
        }
        let config = await Outros_1.WelcomeModel.findOne({ guildId });
        if (!config)
            config = new Outros_1.WelcomeModel({ guildId });
        if (action === 'canal') {
            const targetChannel = message.mentions?.channels?.first();
            if (!targetChannel)
                return message.reply('❌ Mencione o canal! Ex: `rp!welcome #geral`');
            config.channelId = targetChannel.id;
            await config.save();
            return message.reply(`✅ Canal de registros definido para <#${targetChannel.id}>!`);
        }
        if (action === 'end') {
            await Outros_1.WelcomeModel.deleteOne({ guildId });
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
            if (!newMsg)
                return message.reply('❌ Escreva a mensagem! Ex: `rp!welcome change "Bem-vindo {user}!"`\n*Você também pode especificar o tipo:* `rp!welcome change ban "{user} se fodeu."`');
            if (targetType === 'join')
                config.joinMsg = newMsg;
            if (targetType === 'leave')
                config.leaveMsg = newMsg;
            if (targetType === 'kick')
                config.kickMsg = newMsg;
            if (targetType === 'ban')
                config.banMsg = newMsg;
            await config.save();
            return message.reply(`✅ Mensagem de **${targetType}** atualizada com sucesso!`);
        }
        return message.reply('👋 **Painel de Registros:**\n\n`rp!welcome #canal` - Define onde enviar\n`rp!welcome change "msg"` - Altera a msg de entrada\n`rp!welcome change <leave/kick/ban> "msg"` - Altera as outras msgs\n`rp!welcome end` - Desliga tudo e reseta\n\n*Variáveis aceitas: `{user}`, `{server}`, `{count}`*');
    }
};
