const { EmbedBuilder, SlashCommandBuilder } = require('discord.js'); 

module.exports = {
    name: 'roll',
    description: 'Rola dados de RPG com estilo',

    // --- ESTRUTURA SLASH ---
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Rola dados (ex: 1d20)')
        .addStringOption(option => 
            option.setName('formula')
                .setDescription('A fórmula (Ex: 1d20+5, 4d6)')
                .setRequired(true)),

    // --- ADAPTADOR SLASH ---
    async executeSlash(interaction) {
        const formula = interaction.options.getString('formula');
        
        const fakeMessage = {
            author: interaction.user,
            content: formula, // Para logica interna se precisar
            reply: async (payload) => interaction.reply(payload)
        };

        // Simula o processamento da string como se fosse args
        // O execute antigo esperava args já quebrados ou a string inteira?
        // O antigo usava args.join mas a lógica real estava no processRoll ou Roll.
        // Vamos chamar a função Roll direto e responder.
        
        const regexDado = /^\s*(\d+)?d(\d+)(\s*[-+*/]\s*\d+)?\s*$/i;
        const match = formula.match(regexDado);

        if (!match) {
            return interaction.reply({ content: "⚠️ Formato inválido. Use algo como `1d20+5`.", ephemeral: true });
        }

        let a = match[1], b = match[2], c = null, d = null;
        if (match[3]) {
            let modLimpo = match[3].replace(/\s/g, '');
            c = modLimpo.charAt(0);
            d = modLimpo.substring(1);
        }

        const res = this.Roll(a, b, c, d);
        if (res.erro) interaction.reply({ content: `⚠️ ${res.erro}`, ephemeral: true });
        else interaction.reply({ embeds: [res.embed] });
    },

    // --- EXECUÇÃO POR COMANDO (rp!roll) ---
    execute(message, args) {
        // O antigo rp!roll era apenas informativo
        message.reply("🎲 Para rolar dados, digite direto: `d20`, `6d6`, `1d10+5`...");
    },

    // --- PROCESSADOR DE MENSAGENS (d20 solto) ---
    async processRoll(message) {
        const regexDado = /^\s*(\d+)?d(\d+)(\s*[-+*/]\s*\d+)?\s*$/i;
        const regexDadoSujo = /^\s*(\d+)?d(\d+)/i;

        // A. Verifica se é um dado perfeito (Ex: 6d10+5)
        const match = message.content.match(regexDado);
        
        if (match) {
            let a = match[1], b = match[2], c = null, d = null;
            if (match[3]) {
                let modLimpo = match[3].replace(/\s/g, '');
                c = modLimpo.charAt(0);
                d = modLimpo.substring(1);
            }

            const resultado = this.Roll(a, b, c, d);
            if (resultado.erro) await message.reply(`⚠️ ${resultado.erro}`);
            else await message.reply({ embeds: [resultado.embed] });
            
            return true; // "Eu cuidei disso"
        }

        // B. Verifica se tem lixo junto (Ex: "d20 pra testar")
        else if (regexDadoSujo.test(message.content)) {
            if (message.content.length < 50) {
                const tentativa = message.content.match(regexDadoSujo)[0];
                await message.reply(`⚠️ Opa! Se você quer rolar um **${tentativa}**, mande a mensagem **sozinha**.`);
                return true; 
            }
        }
        return false;
    },

    // --- MATEMÁTICA E ESTILO (DO ANTIGO) ---
    Roll: function(qtdInput, ladosInput, operador, modificador) {
        let qtd = parseInt(qtdInput) || 1;
        let lados = parseInt(ladosInput);
        
        if (qtd > 100) return { erro: "Calma lá! Meu bolso aguenta só 100 dados." };
        if (lados < 1) return { erro: "Não existem dados de 0 ou menos lados." };

        let resultados = [];
        let somaBruta = 0;

        for (let i = 0; i < qtd; i++) {
            let valor = Math.floor(Math.random() * lados) + 1;
            resultados.push(valor);
            somaBruta += valor;
        }

        // --- LÓGICA DE CORES ORIGINAL ---
        const minPossivel = qtd;
        const maxPossivel = qtd * lados;
        let corFinal;

        // 1. Extremos Absolutos
        if (somaBruta === minPossivel) {
            corFinal = 0x66000a; // Vermelho Sangue (Falha Crítica)
        } else if (somaBruta === maxPossivel) {
            corFinal = 0x0099FF; // Azul Maravilhoso (Sucesso Crítico)
        } else {
            // 2. Cálculo da Porcentagem
            const range = maxPossivel - minPossivel;
            const porcentagem = range === 0 ? 100 : ((somaBruta - minPossivel) / range) * 100;

            if (porcentagem >= 40 && porcentagem <= 60) {
                // MÉDIA (Amarelo)
                const distCentro = Math.abs(50 - porcentagem); 
                corFinal = distCentro < 4 ? 0xffb700 : 0xf0ddaf; 
            } else if (porcentagem < 40) {
                // RUIM (Vermelho)
                corFinal = porcentagem < 20 ? 0xa10010 : 0xff8c98;
            } else {
                // BOM (Verde)
                corFinal = porcentagem > 80 ? 0x008000 : 0x90EE90;
            }
        }

        resultados.sort((a, b) => a - b);

        let totalFinal = somaBruta;
        let textoModificador = "";

        if (operador && modificador) {
            let valMod = parseInt(modificador);
            textoModificador = ` ${operador}${valMod}`;
            if (operador === '+') totalFinal += valMod;
            if (operador === '-') totalFinal -= valMod;
            if (operador === '*') totalFinal *= valMod;
            if (operador === '/') totalFinal = Math.floor(totalFinal / valMod);
        }

        let listaStr = resultados.join(', ');
        if (listaStr.length > 50) listaStr = listaStr.substring(0, 50) + "...";
        
        const embed = new EmbedBuilder()
            .setColor(corFinal)
            .setAuthor({ name: 'Dadinhos! 🎲', iconURL: 'https://media.discordapp.net/attachments/1459362898127098014/1459399809025703988/doguinho.png?ex=6963237c&is=6961d1fc&hm=7ea6574e5b4cc8904ba7547339c89c3874e6955bff8c72973a1aa8090422305b&=&format=webp&quality=lossless' })
            .setDescription(`**[${qtd}d${lados}${textoModificador} : ${listaStr}]**\n No fim, a soma de todos os dados deu: \n **${totalFinal}**`)
            .setFooter({ text: `RPTool v1.2` });
        
        return { erro: null, embed: embed };
    }
};