const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'webhook', 
    description: 'Sistema de Tuppers/Webhooks',
    
    // PARTE 1: Se alguém digitar rp!webhook (Ajuda básica)
    execute(message, args) {
        message.reply("🎭 Este sistema é automático! Apenas digite o prefixo do seu personagem para usá-lo.");
    },

    // PARTE 2: A Lógica Pesada (O Sistema)
    async processMessage(message, client) {
        // Carrega os tuppers
        const dbPath = path.join(__dirname, '../Data/tuppers.json');
        let tuppers = [];
        try {
            tuppers = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        } catch (e) { tuppers = []; }

        // Filtra tuppers do dono da mensagem
        const userTuppers = tuppers.filter(t => t.uid === message.author.id);
        
        // Verifica prefixo
        const tupperFound = userTuppers.find(t => message.content.startsWith(t.prefix + ":") || message.content.startsWith(t.prefix + " "));

        if (!tupperFound) return false; // Retorna FALSE: "Não era comigo, pode seguir"

        // ============================================================
        // 🛑 TRAVA DE SEGURANÇA DA IA 🛑
        // ============================================================
        // Se o tupper é uma IA, o sistema de webhook deve IGNORAR.
        // Isso permite que o código no index.js processe o "prefixo:ai".
        if (tupperFound.ai_enabled) {
            return false; // Deixa passar pro index.js
        }
        // ============================================================

        // --- ACHOU (E é normal)! Executa a lógica ---
        let textContent = message.content.slice(tupperFound.prefix.length).trim();
        
        // Remove os separadores (: ou espaço) do início da mensagem
        if (textContent.startsWith(':') || textContent.startsWith(' ')) {
            textContent = textContent.substring(1).trim();
        }

        // Se não tem texto nem anexo, ignora
        if (!textContent && message.attachments.size === 0) return false;

        try {
            // Busca ou Cria o Webhook
            const webhooks = await message.channel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.owner.id === client.user.id);

            if (!webhook) {
                webhook = await message.channel.createWebhook({
                    name: 'RPTool Webhook',
                    avatar: client.user.displayAvatarURL(),
                });
            }

            // Envia a mensagem clonada
            await webhook.send({
                content: textContent,
                username: tupperFound.name,
                avatarURL: tupperFound.avatar,
                files: message.attachments.map(a => a.url) 
            });

            // Apaga a original
            try { await message.delete(); } catch (e) {} 
            
            return true; // Retorna TRUE: "Já resolvi, pode parar o código"
        } catch (err) {
            console.error("Erro no Webhook System:", err);
            return false;
        }
    }
};