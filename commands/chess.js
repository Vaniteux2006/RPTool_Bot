const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'chess',
    description: 'Analisa posições de Xadrez com Stockfish',
    async execute(message, args) {
        // Exemplo de uso: 
        // rp!chess start
        // rp!chess solve rnbqk...
        
        const subCommand = args[0];
        let fen = args.slice(1).join(' ');

        // Validação básica: tem que ter 'solve' ou 'start'
        if (!subCommand || (subCommand !== 'solve' && subCommand !== 'start')) {
            return message.reply("♟️ **Uso correto:**\n`rp!chess start` (Tabuleiro inicial)\n`rp!chess solve [FEN]` (Analisa uma posição)");
        }

        // Se for start, define o FEN inicial padrão
        if (subCommand === 'start') fen = "start";
        if (!fen) return message.reply("⚠️ Você precisa fornecer um código FEN para analisar.");

        // Feedback visual
        const msg = await message.reply("🤔 **O Grande Mestre Stockfish está calculando...**");

        try {
            // Tenta conectar com sua API Python
            // Lembre-se: O Python (api.py) precisa estar rodando!
            const response = await fetch('http://127.0.0.1:8000/chess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen: fen, mode: "solve" })
            });

            const data = await response.json();

            // Se o Python devolveu erro (ex: FEN inválido)
            if (data.error) {
                return msg.edit(`❌ **Erro na Engine:** ${data.error}`);
            }

            // --- FORMATAÇÃO BONITA ---
            
            // 1. Texto da Avaliação
            let evalText = "";
            let color = 0x0099FF; // Azul padrão

            if (data.evaluation.type === "mate") {
                evalText = `🏆 MATE em ${data.evaluation.value}`;
                color = 0xFFD700; // Dourado (Vitória iminente)
            } else {
                // O Stockfish devolve em "centipawns" (ex: 150). Dividimos por 100 pra ficar "1.50"
                let pontuacao = (data.evaluation.value / 100).toFixed(2);
                evalText = `${pontuacao}`; 
                
                // Cor dinâmica: Branco ganhando = Branco, Preto ganhando = Preto
                if (pontuacao > 1) color = 0xFFFFFF; 
                if (pontuacao < -1) color = 0x000000; 
            }

            // 2. Imagem do Tabuleiro (Gerada por API externa baseada no FEN)
            const finalFen = data.fen; 
            // encodeURI mantém as barras '/' mas corrige os espaços para '%20'
            const boardImage = `https://fen2image.chessvision.ai/${encodeURI(finalFen)}`;

            // 3. Monta o Embed
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle('🐟 Análise do Stockfish 16')
                .setDescription(`**Melhor Lance Sugerido:** \`${data.best_move}\`\n**Avaliação da Posição:** \`${evalText}\``)
                .setImage(boardImage)
                .setFooter({ text: `Profundidade: 15 lances | Engine Local` });

            // Edita a mensagem de "pensando" com o resultado final
            await msg.edit({ content: '', embeds: [embed] });

        } catch (error) {
            console.error(error);
            msg.edit("❌ **Erro de Conexão:** Não consegui falar com o Python. \n*Dica: Use `rp!ai acordar` para garantir que o sistema está ligado.*");
        }
    }
};