const pythonManager = require('../python_manager.js'); // Importa o gerente

module.exports = {
    name: 'ai',
    description: 'Conversa com um NPC via IA',
    async execute(message, args) {
        const userMessage = args.join(' ');
        if (!userMessage) return message.reply("//bro, você precisa falar algo!");

        let msg = await message.reply("💤 **[ Acordando o Cérebro da IA... ]**");

        try {
            // A MÁGICA ACONTECE AQUI:
            // O código abaixo liga o Python se estiver desligado, ou só mantém ligado se já estiver.
            await pythonManager.ensureConnection();
            
            await msg.edit("🧠 **[ Processando... ]**");

            const npcData = {
                npc_name: "RPTool",
                persona: "Você é um bot assistente de RPG. Seja útil e breve.",
                user_message: userMessage
            };

            const response = await fetch('http://127.0.0.1:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(npcData)
            });

            const data = await response.json();
            msg.edit(`${data.reply}`);

        } catch (error) {
            console.error(error);
            msg.edit("❌ Erro: Não consegui ligar o Python. Veja o terminal.");
        }
    },
};