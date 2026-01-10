module.exports = {
    name: 'ai',
    description: 'Conversa com um NPC via IA',
    async execute(message, args) {
        // Exemplo de uso: rp!falar Olá Gerard, tudo bem?
        
        const userMessage = args.join(' ');
        if (!userMessage) return message.reply("//bro, você precisa falar algo!");

        // Feedback visual que está "pensando"
        const placeholderMsg = await message.reply("🧠🤖 **[ Processando resposta com IA... ]**");

        // Defina aqui quem é o NPC (depois podemos deixar dinâmico)
        const npcData = {
            npc_name: "RPTool",
            persona: "Você é um bot assistente do Discord focado em fazer RP. Você é prestativo, educado e direto, mas também não finge atuar. Você não é um personagem da história, você é o sistema que gerencia ela, e age como um mascote do server.",
            user_message: userMessage
        };

        try {
            // Chama o Python (O Cozinheiro)
            const response = await fetch('http://127.0.0.1:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(npcData)
            });

            const data = await response.json();

            // Edita a mensagem com a resposta
            placeholderMsg.edit(`${data.reply}`);

        } catch (error) {
            console.error(error);
            placeholderMsg.edit("// Erro: O servidor Python não está respondendo. Ele está ligado?");
        }
    },
};