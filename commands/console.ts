import axios from 'axios';
import { Message, EmbedBuilder } from 'discord.js';

export default {
    name: 'console',
    aliases: ['js', 'run', 'eval'],
    description: 'Executa código JavaScript em uma Sandbox segura (Piston API).',
    execute: async (message: Message, args: string[]) => {
        // Pega o código removendo o comando e a formatação do Discord (```js ... ```)
        let code = message.content.replace(/^rp!(console|js|run|eval)(\s+js)?\s*/i, "");
        code = code.replace(/^```(js|javascript)?|```$/g, "").trim();

        if (!code) {
            return message.reply("❌ Digite algum código! Exemplo: `rp!js console.log('Olá Mundo!');`");
        }

        const aguardeMsg = await message.reply("⏳ Executando em ambiente seguro...");

        try {
            // Envia o código para a Piston API (endpoint oficial; version '*' pega
            // a versão de Node disponível no runtime — não envelhece)
            const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
                language: 'javascript',
                version: '*',
                files: [
                    { content: code }
                ],
                compile_timeout: 10000,
                run_timeout: 3000, // Se tiver while(true), ele mata em 3 segundos
            }, { timeout: 20_000 });

            const data = response.data;
            const output = data.run.output || "✅ Código executado sem retornos visíveis.";
            
            // Limita o tamanho do retorno para não estourar o limite do Discord
            const safeOutput = output.length > 1900 ? output.substring(0, 1900) + "\n... [Saída muito longa]" : output;

            const embed = new EmbedBuilder()
                .setColor(data.run.code === 0 ? '#00FF00' : '#FF0000') // Verde se deu certo, vermelho se deu erro
                .setTitle('💻 Console JavaScript (Sandbox)')
                .setDescription(`\`\`\`js\n${safeOutput}\n\`\`\``)
                .setFooter({ text: `Tempo de execução: ${data.compile?.code === 0 ? data.run.stdout : 'N/A'}` });

            await aguardeMsg.edit({ content: null, embeds: [embed] });

        } catch (error: any) {
            console.error('[Piston API Error]', error.message);
            await aguardeMsg.edit("❌ Ocorreu um erro ao tentar executar o código na Sandbox remota.");
        }
    }
};