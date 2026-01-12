const pythonManager = require('../python_codes/python_manager.js');

module.exports = {
    name: 'phone',
    description: 'Sistema de Telefone Inter-Servidores',
    
    async execute(message, args) {
        const action = args[0] ? args[0].toLowerCase() : null;
        const serverId = message.guild.id;
        const validActions = ['register', 'call', 'group', 'accept', 'decline', 'end', 'off'];

        if (!action || !validActions.includes(action)) {
            return message.reply("📱 **Telefone:** Use `register [nome], call [id/nome], group, accept, decline, end, off`.");
        }

        await pythonManager.ensureConnection();

        let payload = { action: action, server_id: serverId };

        switch (action) {
            case 'register':
                payload.channel_id = message.channel.id;
                // Pega o nome se tiver (rp!phone register CidadeAlta)
                if (args[1]) {
                    payload.marker = args.slice(1).join(" "); // Junta tudo caso o nome tenha espaço
                }
                break;

            case 'call':
            case 'group':
                const target = args.slice(1).join(" "); // Suporta nomes com espaço
                if (!target) return message.reply(`⚠️ Digite o ID ou o NOME do servidor alvo.\nEx: \`rp!phone ${action} CidadeAlta\``);
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
            
            // Tratamento de respostas (Switch Output)
            switch (data.status) {
                case 'busy':
                    message.reply(data.msg); 
                    break;
                case 'ringing':
                    message.reply(`📞 **Chamando...** (Aguardando resposta)`);
                    notifyServer(message.client, data.target_channel, `📞 **TRIM TRIM!** O servidor **${message.guild.name}** está ligando!\nDigite \`rp!phone accept\` para atender.`);
                    break;
                case 'voting_started':
                    message.reply("🗳️ **Solicitação enviada!** Aguardando votos.");
                    data.channels.forEach(cId => notifyServer(message.client, cId, `🙋‍♂️ **PEDIDO DE ENTRADA:** O servidor **${message.guild.name}** quer entrar na call!\nDigite \`rp!phone accept\` ou \`rp!phone decline\`.`));
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

    // --- LISTENER (Atualizado com channel_id) ---
    async processPhoneMessage(message) {
        if (message.author.bot || message.content.startsWith('rp!')) return false;
        if (message.attachments.size > 0) return false;

        try {
            await pythonManager.ensureConnection();

            const payload = {
                content: message.content,
                user_name: message.author.username,
                server_name: message.guild.name,
                server_id: message.guild.id,
                channel_id: message.channel.id // ENVIANDO O ID DO CANAL
            };

            const response = await fetch('http://127.0.0.1:8000/phone/transmit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.targets && data.targets.length > 0) {
                //message.react('📡'); 
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