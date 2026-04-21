import { Message, TextChannel } from 'discord.js';
import * as discordTranscripts from 'discord-html-transcripts';

export default {
    name: 'exportchat',
    description: 'Exporta todo o chat para HTML quebrando em arquivos.',
    aliases: ['exportar', 'backupchat'],

    async execute(message: Message, args: string[]) {
        if (!message.member?.permissions.has('Administrator')) {
            return message.reply('❌ Apenas administradores podem exportar chats.');
        }

        const chatComandosId = message.channel.id;
        let targetChannel = message.channel as TextChannel;

        if (args.length > 0) {
            const targetId = args[0].replace(/[^0-9]/g, '');
            const mentionedChannel = message.guild?.channels.cache.get(targetId);
            
            if (!mentionedChannel || !mentionedChannel.isTextBased()) {
                return message.reply('❌ Canal inválido! Use o formato: `rp!exportchat #nome-do-canal`');
            }
            targetChannel = mentionedChannel as TextChannel;
        }

        const limitPerFile = 1000; 
        let allMessages: Message[] = [];
        let lastId: string | undefined = undefined;

        const statusMsg = await message.reply(`⏳ Vasculhando o canal <#${targetChannel.id}> para baixar as mensagens...`);

        // 1. PRIMEIRO LÊ TUDO E GUARDA NA MEMÓRIA
        while (true) {
            const fetched = await targetChannel.messages.fetch({ limit: 100, before: lastId });
            if (fetched.size === 0) break;

            allMessages.push(...Array.from(fetched.values()));
            lastId = fetched.last()?.id;
        }

        if (allMessages.length === 0) {
            return statusMsg.edit('❌ O canal está vazio!');
        }

        // Faz a matemática de quantos arquivos vão dar
        const totalFiles = Math.ceil(allMessages.length / limitPerFile);

        // 2. AVISA E JÁ COMEÇA A GERAR SEM FRESBURA DE BOTÃO
        await statusMsg.edit(`⏳ Foram encontradas **${allMessages.length} mensagens**! Iniciando a geração de **${totalFiles} arquivos**...`);

        // 3. INVERTE A ORDEM E GERA OS ARQUIVOS
        // Precisamos reverter para a ordem cronológica (de cima pra baixo)
        allMessages.reverse();
        const chatComandos = message.client.channels.cache.get(chatComandosId) as TextChannel;

        // Esse loop corta o array gigante em "fatias" de 15.000 mensagens
        for (let i = 0; i < totalFiles; i++) {
            const chunk = allMessages.slice(i * limitPerFile, (i + 1) * limitPerFile);
            
            const attachment = await discordTranscripts.generateFromMessages(chunk, targetChannel, {
                returnType: discordTranscripts.ExportReturnType.Attachment, 
                filename: `backup_${targetChannel.name}_parte${i + 1}.html`,
                saveImages: false // Imagens desativadas pra não pesar!
            });

            await chatComandos.send({ 
                content: `📦 **Parte ${i + 1}/${totalFiles}** do canal <#${targetChannel.id}> gerada com sucesso!`, 
                files: [attachment] 
            });
        }

        await statusMsg.edit(`✅ **Exportação de ${totalFiles} arquivos do chat <#${targetChannel.id}> concluída com sucesso!**`);
    }
};