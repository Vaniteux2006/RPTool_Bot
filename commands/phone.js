const { SlashCommandBuilder } = require('discord.js');
const pythonManager = require('../python_codes/python_manager.js');

module.exports = {
    name: 'phone',
    description: 'Sistema de Telefone Inter-Servidores',
    
    data: new SlashCommandBuilder()
        .setName('phone')
        .setDescription('Telefone Inter-Servidores')
        .addSubcommand(sub => 
            sub.setName('call')
                .setDescription('Liga para um servidor')
                .addStringOption(op => op.setName('alvo').setDescription('ID ou Nome do servidor').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('register')
                .setDescription('Instala o telefone neste canal')
                .addStringOption(op => op.setName('nome').setDescription('Nome público do local').setRequired(false)))
        .addSubcommand(sub => sub.setName('accept').setDescription('Atende uma chamada'))
        .addSubcommand(sub => sub.setName('decline').setDescription('Recusa uma chamada'))
        .addSubcommand(sub => sub.setName('end').setDescription('Desliga a chamada'))
        .addSubcommand(sub => sub.setName('group').setDescription('Pede para entrar na chamada em grupo')
             .addStringOption(op => op.setName('alvo').setDescription('ID ou Nome de quem já está na call').setRequired(true))),

    async executeSlash(interaction) {
        const sub = interaction.options.getSubcommand();
        const args = [sub]; 

        if (sub === 'call' || sub === 'group') {
            args.push(interaction.options.getString('alvo')); 
        }
        else if (sub === 'register') {
            const nome = interaction.options.getString('nome');
            if (nome) args.push(nome);
        }

        const fakeMessage = {
            content: `rp!phone ${args.join(' ')}`,
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            client: interaction.client, 
            reply: async (payload) => {
                if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
                return interaction.reply(payload);
            }
        };

        await this.execute(fakeMessage, args);
    },

    async execute(message, args) {
        const action = args[0] ? args[0].toLowerCase() : null;
        const serverId = message.guild.id;
        const validActions = ['register', 'call', 'group', 'accept', 'decline', 'end', 'off'];

        if (!action || !validActions.includes(action)) {
            return message.reply("📱 **Telefone:** Use `register, call, group, accept, decline, end`.");
        }

        await pythonManager.ensureConnection();

        let payload = { action: action, server_id: serverId };

        switch (action) {
            case 'register':
                payload.channel_id = message.channel.id;
                if (args[1]) payload.marker = args.slice(1).join(" ");
                break;

            case 'call':
            case 'group':
                const target = args.slice(1).join(" ");
                if (!target) return message.reply(`⚠️ Digite o ID ou o NOME do servidor alvo.`);
                payload.target_id = target;
                break;
        }

        try {
            const response = await fetch('http://127.0.0.1:8000/phone/cmd', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (data.error) return message.reply(`❌ **Erro:** ${data.error}`);
            
            switch (data.status) {
                case 'busy':
                    message.reply(data.msg); 
                    break;
                case 'ringing':
                    message.reply(`📞 **Chamando...** (Aguardando resposta)`);
                    notifyServer(message.client, data.target_channel, `📞 **TRIM TRIM!** O servidor **${message.guild.name}** está ligando!\nDigite \`/phone accept\` para atender.`);
                    break;
                case 'voting_started':
                    message.reply("🗳️ **Solicitação enviada!** Aguardando votos.");
                    data.channels.forEach(cId => notifyServer(message.client, cId, `🙋‍♂️ **PEDIDO DE ENTRADA:** O servidor **${message.guild.name}** quer entrar na call!\nDigite \`/phone accept\` ou \`/phone decline\`.`));
                    break;
                case 'vote_registered':
                    message.reply(`✅ **Voto Confirmado!** Faltam **${data.remaining}** aprovações.`);
                    break;
                case 'group_joined':
                    message.reply("🎉 **Você entrou na ligação!**"); 
                    data.channels.forEach(cId => notifyServer(message.client, cId, `👋 **${message.guild.name}** entrou na conversa!`));
                    break;
                case 'group_denied':
                    message.reply("🚫 **Entrada Vetada.** Alguém da call recusou.");
                    notifyServer(message.client, data.requester_channel, "🚫 **Seu pedido foi recusado.**");
                    break;
                case 'connected':
                    message.reply("🟢 **Ligação Conectada!**");
                    data.partners.forEach(cId => notifyServer(message.client, cId, `🟢 **${message.guild.name}** atendeu!`));
                    break;
                case 'ended':
                    message.reply("🔴 **Ligação Encerrada.**");
                    data.notify_channels.forEach(cId => notifyServer(message.client, cId, `🔴 **${message.guild.name}** desligou.`));
                    break;
                case 'declined':
                    message.reply("🚫 **Chamada Recusada.**");
                    notifyServer(message.client, data.target_channel, `🚫 **${message.guild.name}** recusou a chamada.`);
                    break;
                case 'ok':
                    message.reply(`📱 ${data.msg}`);
                    break;
                default:
                    message.reply(`📱 ${data.msg || "Comando processado."}`);
            }

        } catch (e) {
            console.error(e);
            message.reply("❌ Erro de conexão com a Central Telefônica.");
        }
    },

    async processPhoneMessage(message) {
        if (message.author.bot || message.content.startsWith('rp!') || message.content.startsWith('/')) return false;
        if (message.attachments.size > 0) return false;

        try {
            await pythonManager.ensureConnection();

            const payload = {
                content: message.content,
                user_name: message.author.username,
                server_name: message.guild.name,
                server_id: message.guild.id,
                channel_id: message.channel.id 
            };

            const response = await fetch('http://127.0.0.1:8000/phone/transmit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.targets && data.targets.length > 0) {
                data.targets.forEach(channelId => {
                    notifyServer(message.client, channelId, data.msg);
                });
                return true;
            }
        } catch (e) {}
        return false;
    }
};

async function notifyServer(client, channelId, text) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel) channel.send(text);
    } catch (e) { console.error(`Erro ao notificar ${channelId}:`, e); }
}