import { SlashCommandBuilder, ChatInputCommandInteraction, Message, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import axios from 'axios';

export default {
    name: 'math',
    description: 'Calculadora avançada com Wolfram Alpha',

    data: new SlashCommandBuilder()
        .setName('math')
        .setDescription('Resolve equações, plota gráficos e calcula expressões via Wolfram Alpha')
        .addStringOption(option => 
            option.setName('expressao')
                .setDescription('Ex: "solve x^2 + 4x + 4 = 0" ou LaTeX')
                .setRequired(true)),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply(); 
        const expr = interaction.options.getString('expressao') || "";
        this.calculate(interaction, expr);
    },

    async execute(message: Message, args: string[]) {
        const expr = args.join(' ');
        
        if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
             await message.channel.sendTyping(); 
        }

        this.calculate(message, expr);
    },

    async calculate(target: any, expression: string) {
        try {
            if (!expression) {
                return this.sendReply(target, '⚠️ Por favor, forneça uma expressão matemática.');
            }

            const wolframTokens = process.env.WOLFRAM_IDS?.split(',') || [];
            if (wolframTokens.length === 0) {
                return this.sendReply(target, '❌ Erro de configuração: Nenhum token do Wolfram encontrado no .env.');
            }
            const randomToken = wolframTokens[Math.floor(Math.random() * wolframTokens.length)].trim();

            const url = `http://api.wolframalpha.com/v2/query?input=${encodeURIComponent(expression)}&appid=${randomToken}&output=json`;

            const response = await axios.get(url);
            const data = response.data.queryresult;

            if (!data.success) {
                if (data.didyoumeans && data.didyoumeans.length > 0) {
                    return this.sendReply(target, `❌ Não entendi. Você quis dizer: \`${data.didyoumeans[0].val}\`?`);
                }
                return this.sendReply(target, '❌ O Wolfram não conseguiu interpretar essa expressão.');
            }

            const pods = data.pods;
            const embed = new EmbedBuilder()
                .setColor(0xFF4500) 
                .setTitle('🐺 Resultado Wolfram Alpha')
                .setFooter({ text: `Consultado por: ${target.user?.username || target.author?.username}` });

            let hasImage = false;
            let resultText = '';

            for (const pod of pods) {
                const title = pod.title.toLowerCase();
                const subpod = pod.subpods[0];
                const textContent = subpod.plaintext;
                const imageUrl = subpod.img.src;

                if (title === 'input' || title === 'input interpretation') {
                    embed.addFields({ name: '📥 Entrada Interpretada', value: `\`${textContent || 'Imagem'}\`` });
                }
                else if (title.includes('result') || title.includes('solution') || title.includes('decimal approximation')) {
                    resultText = textContent;
                    embed.addFields({ name: '✅ Resultado', value: `\`\`\`${textContent}\`\`\`` });
                }
                else if ((title.includes('plot') || title.includes('graph')) && !hasImage) {
                    embed.setImage(imageUrl);
                    hasImage = true;
                }
            }

            if (!resultText && pods.length > 1) {
                 const fallbackPod = pods[1];
                 if (fallbackPod.subpods[0].plaintext) {
                    embed.addFields({ name: '📝 Info', value: `\`\`\`${fallbackPod.subpods[0].plaintext}\`\`\`` });
                 }
            }

            this.sendReply(target, { embeds: [embed] });

        } catch (err) {
            console.error(err);
            this.sendReply(target, '❌ Ocorreu um erro ao conectar com a API do Wolfram.');
        }
    },

    async sendReply(target: any, content: any) {
        if (target.deferred || target.replied) {
            return target.editReply(content);
        } else if (target.reply) {
            return target.reply(content);
        } else {
            return target.channel.send(content);
        }
    }
};