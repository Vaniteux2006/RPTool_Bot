const { EmbedBuilder } = require('discord.js');

// VARIÁVEL GLOBAL (Na memória RAM do Node)
// Guarda: { channelId: { active: true, tupperName: "Nome", ownerId: "ID", buffer: [] } }
global.aiSessions = global.aiSessions || {}; 

module.exports = {
    name: 'insert',
    description: 'Insere (ou remove) um Tupper com IA na conversa',
    async execute(message, args) {
        const action = args[0];

        if (action === 'end') {
            if (global.aiSessions[message.channel.id]) {
                delete global.aiSessions[message.channel.id];
                return message.reply("🛑 **Sessão de IA encerrada.** O bot parou de ouvir.");
            }
            return message.reply("?? Não tem ninguém inserido aqui.");
        }

        const tupperName = args.join(' ');
        if (!tupperName) return message.reply("Quem você quer inserir?");

        // Inicia a Sessão
        global.aiSessions[message.channel.id] = {
            active: true,
            tupperName: tupperName,
            ownerId: message.author.id,
            buffer: [] // Aqui ficam as mensagens temporárias
        };

        message.reply(`👁️ **${tupperName} está observando.**\nO bot está lendo o chat.\nUse \`prefixo:ai [ação]\` para interagir.`);
    }
};