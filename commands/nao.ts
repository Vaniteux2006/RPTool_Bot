import { Message } from 'discord.js';
import translate from 'google-translate-api-x';

export default {
    name: 'não',
    description: 'Retorna uma desculpa criativa (e traduzida) do no-as-a-service.',
    aliases: ['nao', 'no', 'nein', 'nope', 'n'], 
    
    async execute(message: Message, args: string[]) {
        // Envia um feedback visual enquanto processa a requisição e a tradução
        const msg = await message.reply('🤔 Pensando em uma boa desculpa...');

        try {
            // 1. Busca a desculpa em inglês da API oficial do No-as-a-Service
            const response = await fetch('https://naas.isalman.dev/no');
            
            if (!response.ok) {
                throw new Error('Falha na comunicação com a API NaaS');
            }

            const data = await response.json();
            const reasonInEnglish = data.reason;

            // 2. Traduz a desculpa para o português
            const translation = (await translate(reasonInEnglish, { to: 'pt' })) as any;

            // 3. Edita a mensagem temporária com a resposta final traduzida
            await msg.edit(`❌ **Não quero / Não posso.**\nMotivo: *${translation.text}*`);

        } catch (error) {
            console.error('Erro ao executar o comando rp!não:', error);
            await msg.edit('❌ Até para te dar uma desculpa o meu sistema falhou. A resposta é simplesmente **não**!');
        }
    }
};