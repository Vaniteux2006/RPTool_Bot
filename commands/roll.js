const { EmbedBuilder } = require('discord.js'); 

module.exports = {
    name: 'roll',
    description: 'Rola dados de RPG com estilo',
    
    // 1. Comando rp!roll (Apenas informativo)
    execute(message, args) {
        message.reply("🎲 Para rolar dados, digite direto: `d20`, `6d6`, `1d10+5`...");
    },

    // 2. O Processador de Mensagens (A Faxina do index.js)
    async processRoll(message) {
        // Regex definitions
        const regexDado = /^\s*(\d+)?d(\d+)(\s*[-+*/]\s*\d+)?\s*$/i;
        const regexDadoSujo = /^\s*(\d+)?d(\d+)/i;

        // A. Verifica se é um dado perfeito (Ex: 6d10+5)
        const match = message.content.match(regexDado);
        
        if (match) {
            let a = match[1]; 
            let b = match[2];
            let c = null; 
            let d = null;
            
            if (match[3]) {
                let modLimpo = match[3].replace(/\s/g, '');
                c = modLimpo.charAt(0);
                d = modLimpo.substring(1);
            }

            // Chama a função matemática interna (usando 'this')
            const resultado = module.exports.Roll(a, b, c, d);

            if (resultado.erro) {
                await message.reply(`⚠️ ${resultado.erro}`);
            } else {
                await message.reply({ embeds: [resultado.embed] });
            }
            return true; // Retorna TRUE: "Eu cuidei disso"
        }

        // B. Verifica se tem lixo junto (Ex: "d20 pra testar")
        else if (regexDadoSujo.test(message.content)) {
            if (message.content.length < 50) {
                const tentativa = message.content.match(regexDadoSujo)[0];
                await message.reply(`⚠️ Opa! Se você quer rolar um **${tentativa}**, mande a mensagem **sozinha**.`);
                return true; // Retorna TRUE: "Eu avisei o usuário"
            }
        }

        return false; // Retorna FALSE: "Não é dado, segue o baile"
    },

    // 3. A Matemática Pura (Mantivemos isolada e pura)
    // 3. A Matemática Pura
    Roll: function(qtdInput, ladosInput, operador, modificador) {
        let qtd = parseInt(qtdInput) || 1;
        let lados = parseInt(ladosInput);
        
        if (qtd > 100) return { erro: "Calma lá! O limite físico é 100 dados." };
        if (lados < 1) return { erro: "Não existem dados de 0 ou menos lados." };

        let resultados = [];
        let somaBruta = 0;

        for (let i = 0; i < qtd; i++) {
            let valor = Math.floor(Math.random() * lados) + 1;
            resultados.push(valor);
            somaBruta += valor;
        }

        // --- INÍCIO DA LÓGICA DE CORES (Inserido Aqui) ---
        const minPossivel = qtd;             // Ex: 6d10, min é 6
        const maxPossivel = qtd * lados;     // Ex: 6d10, max é 60
        let corFinal;

        // 1. Extremos Absolutos
        if (somaBruta === minPossivel) {
            corFinal = 0x66000a; // Vermelho Sangue (Crítico de Falha)
        } else if (somaBruta === maxPossivel) {
            corFinal = 0x0099FF; // Azul Maravilhoso (Crítico de Sucesso)
        } else {
            // 2. Cálculo da Porcentagem (0 a 100%)
            // Evita divisão por zero se alguém rolar 1d1
            const range = maxPossivel - minPossivel;
            const porcentagem = range === 0 ? 100 : ((somaBruta - minPossivel) / range) * 100;

            if (porcentagem >= 40 && porcentagem <= 60) {
                // MÉDIA (Amarelo)
                // Calcula a distância do centro exato (50%). 
                // Se for 0 (bem no centro), amarelo forte. Se for 10 (nas bordas 40 ou 60), fraco.
                const distCentro = Math.abs(50 - porcentagem); 
                corFinal = distCentro < 4 ? 0xffb700 : 0xf0ddaf; // Gold (Forte) vs LightYellow (Fraco)
            
            } else if (porcentagem < 40) {
                // RUIM (Vermelho)
                // < 20% (Muito ruim) = Vermelho Escuro | 20-39% (Ruim, mas ok) = Vermelho Claro
                corFinal = porcentagem < 20 ? 0xa10010 : 0xff8c98; // FireBrick vs LightCoral

            } else {
                // BOM (Verde)
                // > 80% (Muito bom) = Verde Forte | 61-79% (Bom) = Verde Claro
                corFinal = porcentagem > 80 ? 0x008000 : 0x90EE90; // Green vs LightGreen
            }
        }
        // --- FIM DA LÓGICA DE CORES ---

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
            .setColor(corFinal) // <--- Alterado para usar a variável dinâmica
            .setAuthor({ name: 'Dadinhos! 🎲', iconURL: 'https://media.discordapp.net/attachments/1459362898127098014/1459399809025703988/doguinho.png?ex=6963237c&is=6961d1fc&hm=7ea6574e5b4cc8904ba7547339c89c3874e6955bff8c72973a1aa8090422305b&=&format=webp&quality=lossless' })
            .setDescription(`**[${qtd}d${lados}${textoModificador} : ${listaStr}]**\n No fim, a soma de todos os dados deu: \n **${totalFinal}**`);

        return { erro: null, embed: embed };
    }
};