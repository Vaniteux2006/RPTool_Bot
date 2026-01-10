const { EmbedBuilder } = require('discord.js'); // Importa o construtor de Embeds

module.exports = {
    name: 'roll',
    description: 'Rola dados de RPG com estilo',
    execute(message, args) {
        message.reply("🎲 Para rolar dados, digite direto: `d20`, `6d6`, `1d10+5`...");
    },

    Roll: function(qtdInput, ladosInput, operador, modificador) {
        // --- LÓGICA MATEMÁTICA (Igualzinho antes) ---
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

        // --- AQUI MUDA: CRIAÇÃO DO EMBED ---
        
        const embed = new EmbedBuilder()
            .setColor(0x57F287) // O Verde "Tatsumaki" (Green Apple)
            .setAuthor({ name: 'Dadinhos! 🎲', iconURL: 'https://media.discordapp.net/attachments/1459362898127098014/1459399809025703988/doguinho.png?ex=6963237c&is=6961d1fc&hm=7ea6574e5b4cc8904ba7547339c89c3874e6955bff8c72973a1aa8090422305b&=&format=webp&quality=lossless' }) // Ícone de dado
            .setDescription(`**[${qtd}d${lados}${textoModificador} : ${listaStr}]**\n No fim, a soma de todos os dados deu: \n **${totalFinal}**`);
            // Se quiser em português:
            // .setDescription(`**[${qtd}d${lados}${textoModificador} : ${listaStr}]**\n\nNo final, o resultado foi: **${totalFinal}**`);

        return {
            erro: null,
            embed: embed // Retornamos o objeto Embed pronto
        };
    }
};