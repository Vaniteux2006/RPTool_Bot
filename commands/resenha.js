const pythonManager = require('../python_codes/python_manager.js');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'resenha',
    description: 'Analisa as últimas 100 mensagens para detectar estado de RESENHA',
    
    // --- SLASH COMMAND ---
    data: new SlashCommandBuilder()
        .setName('resenha')
        .setDescription('O bot julga se o chat está em estado de Resenha (r-01) ou Paz (r-00)'),

    async executeSlash(interaction) {
        await this.execute(interaction);
    },

    // --- LÓGICA PRINCIPAL ---
    async execute(messageOrInteraction, args) {
        // Normaliza para funcionar tanto com msg quanto slash (teu padrão atual)
        const isSlash = messageOrInteraction.commandName === 'resenha';
        const reply = async (txt) => isSlash ? messageOrInteraction.editReply(txt) : messageOrInteraction.reply(txt);
        
        if (isSlash) await messageOrInteraction.deferReply();
        else await messageOrInteraction.channel.sendTyping();

        try {
            await pythonManager.ensureConnection();

            // 1. Coletar as últimas 100 mensagens
            const messages = await messageOrInteraction.channel.messages.fetch({ limit: 100 });
            
            // 2. Formatar para a IA ler (Do mais antigo pro mais novo)
            const chatLog = messages.reverse().map(m => {
                // Ignora mensagens do próprio bot pra ele não se auto-analisar num loop
                if (m.author.bot) return null;
                return `[${m.author.username}]: ${m.content}`;
            }).filter(Boolean); // Remove nulos

            if (chatLog.length < 10) {
                return reply("❌ Poucas mensagens para analisar resenha (mínimo 10).");
            }

            // 3. Enviar para a API Python
            const response = await fetch('http://127.0.0.1:8000/resenha/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatLog })
            });

            const data = await response.json();

            // 4. Exibir resultado
            const color = data.status === 'r-01' ? 0xFF0000 : 0x00FF00; // Vermelho se for Resenha, Verde se não
            const titulo = data.status === 'r-01' ? "🚨 ALERTA DE RESENHA CONFIRMADA (r-01)" : "🍃 Estado de Paz (r-00)";

            const embed = new EmbedBuilder()
                .setTitle(titulo)
                .setDescription(data.analysis)
                .setColor(color)
                .setFooter({ text: `Analisadas ${chatLog.length} mensagens` });

            return reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            return reply("❌ Erro ao contatar o Departamento de Análise de Resenha (Python Off?)");
        }
    }
};