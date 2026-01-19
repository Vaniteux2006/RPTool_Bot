const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'webhook', 
    description: 'Sistema de Tuppers/Webhooks',

    // --- ESTRUTURA SLASH (Apenas ajuda) ---
    data: new SlashCommandBuilder()
        .setName('webhook')
        .setDescription('Ajuda sobre o sistema de Webhook'),

    async executeSlash(interaction) {
        await interaction.reply({ 
            content: "🎭 **Sistema de Webhooks**\nEste sistema funciona automaticamente! Basta digitar o prefixo do seu personagem no chat (Ex: `p: Olá`).",
            ephemeral: true 
        });
    },
    
    // --- EXECUÇÃO LEGADO (Apenas ajuda) ---
    execute(message, args) {
        message.reply("🎭 Este sistema é automático! Apenas digite o prefixo do seu personagem para usá-lo.");
    },

    // --- LÓGICA PESADA (PROCESSADOR DE MENSAGEM) ---
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

        if (!tupperFound) return false; // Retorna FALSE: "Não era comigo"

        // ============================================================
        // 🛑 TRAVA DE SEGURANÇA DA IA 🛑 (DO ARQUIVO ANTIGO)
        // ============================================================
        // Se o tupper é uma IA, o sistema de webhook deve IGNORAR.
        if (tupperFound.ai_enabled) {
            return false; // Deixa passar pro index.js tratar como IA
        }
        // ============================================================

        let textContent = message.content.slice(tupperFound.prefix.length).trim();
        
        // Remove os separadores (: ou espaço)
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
            
            return true; // Retorna TRUE: "Já resolvi, encerra aqui"
        } catch (err) {
            console.error("Erro no Webhook System:", err);
            return false;
        }
    }
};