const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const pythonManager = require('../python_codes/python_manager.js');
const activeGames = new Map();

module.exports = {
    name: 'chess',
    description: 'Jogue Xadrez contra o Stockfish',

    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Xadrez contra IA')
        .addSubcommand(sub => 
            sub.setName('start')
                .setDescription('Inicia um novo jogo')
                .addStringOption(op => 
                    op.setName('cor')
                    .setDescription('Escolha sua cor (padrão: Brancas)')
                    .addChoices(
                        { name: '⚪ Brancas (Você começa)', value: 'w' },
                        { name: '⚫ Pretas (Bot começa)', value: 'b' }
                    )))
        .addSubcommand(sub => 
            sub.setName('jogar')
                .setDescription('Faz um movimento (ex: d4, Nf3)')
                .addStringOption(op => op.setName('move').setDescription('Seu movimento').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('solve')
                .setDescription('Analisa FEN')
                .addStringOption(op => op.setName('fen').setDescription('FEN').setRequired(true))),

    async executeSlash(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        
        await interaction.deferReply(); 

        try {
            await pythonManager.ensureConnection();

            if (sub === 'start') {
                const cor = interaction.options.getString('cor') || 'w';
                return await this.handleStart(interaction, userId, cor);
            }

            if (sub === 'jogar') {
                const move = interaction.options.getString('move');
                return await this.handlePlay(interaction, userId, move);
            }

            if (sub === 'solve') {
                const fen = interaction.options.getString('fen');
                return await this.handleSolve(interaction, fen);
            }

        } catch (error) {
            console.error(error);
            interaction.editReply("❌ Erro interno no servidor de Xadrez.");
        }
    },

    async execute(message, args) {
        const sub = args[0] ? args[0].toLowerCase() : null;
        const userId = message.author.id;
        const msgRef = await message.reply("🔌 **Conectando à Engine...**");


        const fakeInteraction = {
            user: message.author,
            editReply: async (payload) => {
                if (msgRef.editable) await msgRef.edit(payload);
            }
        };

        try {
            await pythonManager.ensureConnection();

            if (sub === 'start') {
                const corInput = args[1] ? args[1].toLowerCase() : 'w';
                const cor = ['b', 'black', 'preta', 'pretas'].includes(corInput) ? 'b' : 'w';
                return await this.handleStart(fakeInteraction, userId, cor);
            }

            if (sub === 'jogar' || sub === 'play') {
                const move = args[1];
                if (!move) return fakeInteraction.editReply("⚠️ Digite o lance! Ex: `rp!chess jogar e4`");
                return await this.handlePlay(fakeInteraction, userId, move);
            } 
            else if (sub && sub !== 'solve' && sub !== 'help') {
                if (activeGames.has(userId)) {
                    return await this.handlePlay(fakeInteraction, userId, sub);
                }
            }

            if (sub === 'solve') {
                const fen = args.slice(1).join(' ');
                if (!fen) return fakeInteraction.editReply("⚠️ Você precisa colar o código FEN.");
                return await this.handleSolve(fakeInteraction, fen);
            }

            return fakeInteraction.editReply("♟️ **Comandos:**\n`rp!chess start [cor]`\n`rp!chess jogar <lance>`\n`rp!chess solve <fen>`");

        } catch (error) {
            console.error(error);
            fakeInteraction.editReply("❌ Erro ao processar comando legado.");
        }
    },

    async handleStart(interfaceObj, userId, cor) {
        let currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        let botMoveText = "";
        
        if (cor === 'b') {
             currentFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"; 
             botMoveText = "O Bot começou com **e4**.";
        }

        activeGames.set(userId, currentFen);
        
        const embed = new EmbedBuilder()
            .setColor(cor === 'w' ? 0xFFFFFF : 0x000000)
            .setTitle('♟️ Novo Jogo Iniciado')
            .setDescription(`O jogo começou!\n${botMoveText}\n\n**Sua vez:**\nSlash: \`/chess jogar <lance>\`\nTexto: \`rp!chess jogar <lance>\``)
            .setImage(`https://fen2image.chessvision.ai/${encodeURI(currentFen)}`)
            .setFooter({ text: 'Engine: Stockfish 16 • Profundidade 15' });

        return interfaceObj.editReply({ content: '', embeds: [embed] });
    },

    async handlePlay(interfaceObj, userId, move) {
        const storedFen = activeGames.get(userId);
        if (!storedFen) {
            return interfaceObj.editReply("❌ **Você não tem um jogo ativo!** Use `start` primeiro.");
        }

        const response = await fetch('http://127.0.0.1:8000/chess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: storedFen, mode: "play", user_move: move })
        });

        const data = await response.json();

        if (data.error) {
            return interfaceObj.editReply(`⚠️ **Lance Inválido:** ${data.error} (Tente notação SAN, ex: Nf3, e5)`);
        }

        activeGames.set(userId, data.fen);

        let statusText = `Você jogou: **${move}**\nStockfish respondeu: **${data.bot_move}**`;
        let color = 0x0099FF;

        if (data.game_over) {
            statusText = `🏁 **FIM DE JOGO!**\n${data.message || "Xeque-mate ou empate."}`;
            activeGames.delete(userId);
            color = 0xFFD700;
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('♟️ Partida em Andamento')
            .setDescription(statusText)
            .setImage(`https://fen2image.chessvision.ai/${encodeURI(data.fen)}`)
            .setFooter({ text: `Avaliação: ${data.evaluation ? (data.evaluation.value/100).toFixed(2) : '?'}` });

        return interfaceObj.editReply({ content: '', embeds: [embed] });
    },

    async handleSolve(interfaceObj, fen) {
        const response = await fetch('http://127.0.0.1:8000/chess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: fen, mode: "solve" })
        });
        const data = await response.json();
        
        const embed = new EmbedBuilder()
            .setTitle('Análise Rápida')
            .setDescription(`Melhor lance: **${data.best_move}**`)
            .setImage(`https://fen2image.chessvision.ai/${encodeURI(fen)}`);
        
        return interfaceObj.editReply({ content: '', embeds: [embed] });
    }
};