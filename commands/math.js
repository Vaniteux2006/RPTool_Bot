const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'math',
    description: 'Resolve equações e mostra gráficos usando a Full Results API do Wolfram Alpha.',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('❌ Você precisa me dizer o que calcular! Exemplo: `rp!math plot x^2 - 4`.');
        }

        const query = args.join(' ');
        
        // Carrega as chaves do .env (separadas por vírgula)
        const rawIds = process.env.WOLFRAM_IDS;
        if (!rawIds) {
            console.error("ERRO: WOLFRAM_IDS não configurado no .env");
            return message.reply('⚠️ O dono do bot esqueceu de configurar as chaves da API.');
        }
        const apiKeys = rawIds.split(',').map(key => key.trim());

        await message.channel.sendTyping();

        let lastError = null;
        let success = false;

        // --- LOOP DE TENTATIVAS (FAILOVER) ---
        for (const appID of apiKeys) {
            // Usamos a v2/query (Full Results) com output=json para pegar links de imagens e texto
            const url = `http://api.wolframalpha.com/v2/query?appid=${appID}&input=${encodeURIComponent(query)}&output=json`;

            try {
                const response = await axios.get(url);
                const data = response.data;
                
                // Se o JSON não tiver a estrutura esperada ou der erro de API inválida
                if (!data || !data.queryresult) {
                    throw new Error("Resposta inválida da API");
                }

                // O Wolfram retorna 200 OK mesmo se não entender a pergunta,
                // mas marca success = false. Nesse caso, paramos (não adianta trocar chave).
                if (data.queryresult.success === false) {
                    // Verifica se tem sugestão de "DidYouMean"
                    if (data.queryresult.didyoumeans) {
                         const suggestion = data.queryresult.didyoumeans.val || data.queryresult.didyoumeans[0].val;
                         return message.reply(`🤔 Não entendi muito bem. Você quis dizer: \`${suggestion}\`?`);
                    }
                    return message.reply('🤔 Não encontrei uma resposta para isso nos meus dados.');
                }

                // === SUCESSO! Vamos montar a resposta ===
                success = true;
                const pods = data.queryresult.pods;

                const embed = new EmbedBuilder()
                    .setColor(0xFF7F00) // Cor laranja estilo Wolfram
                    .setTitle(`🧮 Resultado para: "${query}"`)
                    .setFooter({ text: 'Powered by Wolfram Alpha' });

                let resultFound = false;
                let plotFound = false;

                // Percorre os "pods" (blocos de informação)
                for (const pod of pods) {
                    // 1. Procura o RESULTADO Principal (Primary Result)
                    if (pod.primary || pod.id === 'Result' || pod.title === 'Result' || pod.id === 'Solution') {
                        // Pega o texto do primeiro subpod
                        const textAnswer = pod.subpods[0].plaintext;
                        if (textAnswer) {
                            embed.addFields({ name: '💡 Resposta', value: `\`\`\`\n${textAnswer}\n\`\`\`` });
                            resultFound = true;
                        }
                    }

                    // 2. Procura por GRÁFICOS (Plots)
                    // Se ainda não achamos um plot, e esse pod tem "Plot" no nome ou id
                    if (!plotFound && (pod.id.includes('Plot') || pod.title.includes('Plot') || pod.id.includes('Graph'))) {
                        const imageUrl = pod.subpods[0].img.src;
                        embed.setImage(imageUrl);
                        plotFound = true;
                    }
                }

                // Se não achou um "Result" primário (ex: fatos aleatórios), pega o segundo pod como resposta
                if (!resultFound && pods.length > 1) {
                     const textAnswer = pods[1].subpods[0].plaintext;
                     if (textAnswer) {
                        embed.addFields({ name: '📄 Informação', value: textAnswer });
                     }
                }

                return message.reply({ embeds: [embed] });

            } catch (error) {
                lastError = error;
                console.log(`⚠️ Falha com a chave ${appID.substring(0, 5)}... Tentando a próxima. Erro: ${error.message}`);
                // Continua para a próxima chave no loop
            }
        }

        // Se saiu do loop, todas as chaves falharam
        console.error("Todas as chaves falharam.", lastError);
        return message.reply('❌ Erro: Tive mais de 10 mil operações (ou erro de rede). Tô cansado, chefe :(');
    },
};