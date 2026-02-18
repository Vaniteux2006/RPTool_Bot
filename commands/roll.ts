import { EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';

export default {
    name: 'roll',
    description: 'Rola dados de RPG com estilo',

    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Rola dados (ex: 1d20)')
        .addStringOption(option => 
            option.setName('formula')
                .setDescription('A fórmula (Ex: 1d20+5, 4d6)')
                .setRequired(true)),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const formula = interaction.options.getString('formula') || "1d20";
        
        const fakeMessage: any = {
            author: interaction.user,
            content: formula, 
            reply: async (payload: any) => interaction.reply(payload)
        };
        
        const success = await this.processRoll(fakeMessage, formula);
        if (!success) {
            await interaction.reply({ content: "⚠️ Formato inválido. Use algo como `1d20+5`.", ephemeral: true });
        }
    },

    async execute(message: Message, args: string[]) {
        const formula = args.join("");
        const success = await this.processRoll(message, formula);
        if (!success) {
            await message.reply("⚠️ Formato inválido. Use algo como `1d20+5`.");
        }
    },

    async processRoll(message: Message | any, formulaInput: string): Promise<boolean> {
        const regexDado = /^\s*(\d+)?d(\d+)(\s*[-+*/]\s*\d+)?\s*$/i;
        
        if (!formulaInput) return false;
        
        const match = formulaInput.match(regexDado);

        if (!match) return false;

        let qtd = match[1] ? parseInt(match[1]) : 1;
        let lados = parseInt(match[2]);
        let modStr = match[3] ? match[3].replace(/\s/g, '') : "";

        if (qtd > 50000) {
            message.reply("Calma lá! Máximo de 50.000 dados.");
            return true;
        }
        if (lados > 1000000) {
            message.reply("Dado muito grande! (pra que dado acima de 1 milhão?)");
            return true;
        }

        let resultados = [];
        let somaBruta = 0;

        for (let i = 0; i < qtd; i++) {
            let val = Math.floor(Math.random() * lados) + 1;
            resultados.push(val);
            somaBruta += val;
        }

        let totalFinal = somaBruta;
        let textoModificador = "";

        if (modStr) {
            const operador = modStr[0];
            const valorMod = parseInt(modStr.substring(1));
            textoModificador = ` ${modStr}`;
            
            if (operador === '+') totalFinal += valorMod;
            if (operador === '-') totalFinal -= valorMod;
            if (operador === '*') totalFinal *= valorMod;
            if (operador === '/') totalFinal = Math.floor(totalFinal / valorMod);
        }

        let corFinal = 0x0099FF;
        if (lados === 20 && qtd === 1) {
            if (resultados[0] === 20) corFinal = 0xFFD700; 
            else if (resultados[0] === 1) corFinal = 0x990000; 
        }

        let listaStr = resultados.join(', ');
        if (listaStr.length > 50) listaStr = listaStr.substring(0, 50) + "...";
        
        const embed = new EmbedBuilder()
            .setColor(corFinal)
            .setAuthor({ name: 'Dadinhos! 🎲', iconURL: 'https://media.discordapp.net/attachments/1459362898127098014/1459399809025703988/doguinho.png?ex=6963237c&is=6961d1fc&hm=7ea6574e5b4cc8904ba7547339c89c3874e6955bff8c72973a1aa8090422305b&=&format=webp&quality=lossless' })
            .setDescription(`**[${qtd}d${lados}${textoModificador} : ${listaStr}]**\n No fim, a soma de todos os dados deu: \n **${totalFinal}**`)
            .setFooter({ text: `RPTool v1.4` });

        await message.reply({ embeds: [embed] });
        return true;
    }
};