const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const pythonManager = require('../python_codes/python_manager.js');

module.exports = {
    name: 'chess',
    description: 'Analisa posições de Xadrez com Stockfish',

    // --- ESTRUTURA SLASH ---
    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Ferramentas de Xadrez')
        .addSubcommand(sub => 
            sub.setName('start')
                .setDescription('Analisa o tabuleiro inicial'))
        .addSubcommand(sub => 
            sub.setName('solve')
                .setDescription('Analisa uma posição específica (FEN)')
                .addStringOption(op => op.setName('fen').setDescription('Código FEN do tabuleiro').setRequired(true))),

    // --- ADAPTADOR SLASH ---
    async executeSlash(interaction) {
        const sub = interaction.options.getSubcommand();
        const args = [sub]; 

        if (sub === 'solve') {
            args.push(interaction.options.getString('fen')); 
        }

        // Fake Message com suporte a Edit
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (content) => {
                await interaction.reply(content);
                return {
                    edit: async (newContent) => interaction.editReply(newContent)
                };
            }
        };

        await this.execute(fakeMessage, args);
    },

    // --- LÓGICA ORIGINAL (LEGADO) ---
    async execute(message, args) {
        
        const subCommand = args[0];
        let fen = args.slice(1).join(' ');

        if (!subCommand || (subCommand !== 'solve' && subCommand !== 'start')) {
            return message.reply("♟️ **Uso correto:**\n`rp!chess start` (Tabuleiro inicial)\n`rp!chess solve [FEN]` (Analisa uma posição)");
        }

        if (subCommand === 'start') fen = "start";
        if (!fen) return message.reply("⚠️ Você precisa fornecer um código FEN.");

        // Feedback de carregamento
        const msg = await message.reply("🔌 **Conectando à Engine (Isso pode levar alguns segundos)...**");

        try {
            await pythonManager.ensureConnection();

            const response = await fetch('http://127.0.0.1:8000/chess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen: fen, mode: "solve" })
            });

            const data = await response.json();

            if (data.error) {
                if(msg.edit) return msg.edit(`❌ **Erro na Engine:** ${data.error}`);
            }

            // --- FORMATAÇÃO (Igual antes) ---
            let evalText = "";
            let color = 0x0099FF;

            if (data.evaluation.type === "mate") {
                evalText = `🏆 MATE em ${data.evaluation.value}`;
                color = 0xFFD700; 
            } else {
                let pontuacao = (data.evaluation.value / 100).toFixed(2);
                evalText = `${pontuacao}`; 
                if (pontuacao > 1) color = 0xFFFFFF; 
                if (pontuacao < -1) color = 0x000000; 
            }

            const finalFen = data.fen; 
            const boardImage = `https://fen2image.chessvision.ai/${encodeURI(finalFen)}`;

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle('🐟 Análise do Stockfish 16')
                .setDescription(`**Melhor Lance:** \`${data.best_move}\`\n**Avaliação:** \`${evalText}\``)
                .setImage(boardImage)
                .setFooter({ text: `Engine Local | Profundidade: 15 • RPTool v1.2` });

            if(msg.edit) await msg.edit({ content: '', embeds: [embed] });
            console.log("Registrado Comando de Xadrez");

        } catch (error) {
            console.error(error);
            if(msg.edit) msg.edit("❌ **Erro:** O Python não quis acordar. Verifique se o arquivo api.py está ok.");
        }
    }
};