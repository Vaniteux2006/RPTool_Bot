const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'webhook', 
    description: 'Sistema de Tuppers/Webhooks',

    data: new SlashCommandBuilder()
        .setName('webhook')
        .setDescription('Ajuda sobre o sistema de Webhook'),

    async executeSlash(interaction) {
        await interaction.reply({ content: "🎭 Sistema automático ativo.", ephemeral: true });
    },
    
    execute(message, args) {
        message.reply("🎭 Sistema automático ativo.");
    },

    async processMessage(message, client) {
        const dbPath = path.join(__dirname, '../Data/tuppers.json');
        let tuppers = [];
        try { tuppers = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { tuppers = []; }

        const userTuppers = tuppers.filter(t => t.uid === message.author.id);
        
        // --- LÓGICA DE DETECÇÃO (BRACKETS) ---
        // Verifica se a mensagem bate com algum bracket de algum personagem
        const tupperFound = userTuppers.find(t => {
            // Suporte legado para quem ainda tem 'prefix' no JSON (Migração suave)
            if (t.prefix && !t.brackets) {
                return message.content.startsWith(t.prefix + ":") || message.content.startsWith(t.prefix + " ");
            }

            // Lógica nova: Brackets [prefix, suffix]
            const prefix = t.brackets[0] || "";
            const suffix = t.brackets[1] || "";

            return message.content.startsWith(prefix) && message.content.endsWith(suffix);
        });

        if (!tupperFound) return false; 

        // 🛑 TRAVA DE SEGURANÇA DA IA
        if (tupperFound.ai_enabled) return false; 

        // --- EXTRAÇÃO DO TEXTO ---
        let textContent = "";

        // Legado
        if (tupperFound.prefix && !tupperFound.brackets) {
            textContent = message.content.slice(tupperFound.prefix.length).trim();
            if (textContent.startsWith(':') || textContent.startsWith(' ')) textContent = textContent.substring(1).trim();
        } 
        // Novo
        else {
            const prefixLen = tupperFound.brackets[0].length;
            const suffixLen = tupperFound.brackets[1].length;
            // Remove prefixo e sufixo
            textContent = message.content.substring(prefixLen, message.content.length - suffixLen).trim();
        }

        if (!textContent && message.attachments.size === 0) return false;

        try {
            const webhooks = await message.channel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.owner.id === client.user.id);

            if (!webhook) {
                webhook = await message.channel.createWebhook({
                    name: 'RPTool Webhook',
                    avatar: client.user.displayAvatarURL(),
                });
            }

            await webhook.send({
                content: textContent,
                username: tupperFound.name,
                avatarURL: tupperFound.avatar, // Agora usa 'avatar' consistente
                files: message.attachments.map(a => a.url) 
            });

            // Incrementa contador de Posts (igual Tupperbox)
            tupperFound.posts = (tupperFound.posts || 0) + 1;
            // Salva estatística
            try { fs.writeFileSync(dbPath, JSON.stringify(tuppers, null, 4)); } catch(e){}

            try { await message.delete(); } catch (e) {} 
            
            return true;
        } catch (err) {
            console.error("Erro no Webhook System:", err);
            return false;
        }
    }
};