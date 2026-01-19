const pythonManager = require('../python_codes/python_manager.js')
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'ai',
    description: 'Conversa com um NPC via IA',

    // --- ESTRUTURA SLASH ---
    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('Conversa com a IA')
        .addStringOption(op => op.setName('mensagem').setDescription('O que você quer falar?').setRequired(true)),

    // --- ADAPTADOR SLASH ---
    async executeSlash(interaction) {
        const msg = interaction.options.getString('mensagem');
        
        // Fake Message que suporta .edit()
        const fakeMessage = {
            author: interaction.user,
            reply: async (content) => {
                // Responde e retorna um objeto com .edit()
                await interaction.reply({ content: content, fetchReply: true });
                return {
                    edit: async (newContent) => interaction.editReply(newContent)
                };
            }
        };
        
        // Passa como array para simular args.join(' ')
        await this.execute(fakeMessage, [msg]);
    },

    // --- LÓGICA ORIGINAL (LEGADO) ---
    async execute(message, args) {
        const userMessage = args.join(' ');
        if (!userMessage) return message.reply("//bro, você precisa falar algo!");

        // Feedback inicial
        let msg = await message.reply("💤 **[ Acordando o Cérebro da IA... ]**");

        try {
            await pythonManager.ensureConnection();
            
            // Função segura de edição (Slash vs Message)
            if (msg.edit) await msg.edit("🧠 **[ Processando... ]**");

            // --- PERSONA ORIGINAL RESTAURADA ---
            const npcData = {
                npc_name: "RPTool",
                persona: "Você é um bot assistente de RPG. Seja útil e breve, respondendo usando gírias de usuário de Discord. E seja muito fã do usuário",
                user_message: userMessage
            };

            const response = await fetch('http://127.0.0.1:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(npcData)
            });

            const data = await response.json();
            
            if (msg.edit) msg.edit(`${data.reply}`);
            console.log("Registrado conversa com IA");

        } catch (error) {
            console.error(error);
            if (msg.edit) msg.edit("❌ Erro: Não consegui ligar o Python. Veja o terminal.");
        }
    },
};