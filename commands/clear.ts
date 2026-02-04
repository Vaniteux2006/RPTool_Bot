import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    Message, 
    ChatInputCommandInteraction, 
    TextChannel,
    ChannelType
} from 'discord.js';

export default {
    name: 'clear',
    aliases: ['limpar', 'purge'],
    description: 'Apaga uma quantidade específica de mensagens.',
    
    // Configuração para Slash Command (/clear)
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Apaga mensagens do chat (Max 100)')
        .addIntegerOption(option => 
            option.setName('quantidade')
                .setDescription('Quantas mensagens apagar')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // Só quem pode gerenciar mensagens vê

    // Execução via Prefixo (rp!clear 10)
    async execute(message: Message, args: string[]) {
        // 1. Verifica Permissões do Usuário
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply("❌ Você precisa da permissão **Gerenciar Mensagens** para usar isso.");
        }

        // 2. Verifica se o bot tem permissão no canal
        const channel = message.channel as TextChannel;
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
             return message.reply("❌ Não posso limpar mensagens neste tipo de canal.");
        }

        // 3. Validação do Número
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply("❌ Por favor, forneça um número entre **1** e **100**.\nExemplo: `rp!clear 5`");
        }

        try {
            // Tenta apagar a mensagem do próprio comando primeiro para limpar tudo bonitinho
            await message.delete().catch(() => {}); 

            // O segundo parâmetro 'true' filtra mensagens com mais de 14 dias (que o Discord proíbe apagar em massa)
            const deleted = await channel.bulkDelete(amount, true);

            const msg = await channel.send(`🧹 **Limpeza concluída!** Apaguei ${deleted.size} mensagens.`);
            
            // Apaga a mensagem de confirmação após 5 segundos
            setTimeout(() => {
                msg.delete().catch(() => {});
            }, 5000);

        } catch (error) {
            console.error(error);
            message.reply("❌ Ocorreu um erro. Lembre-se que não posso apagar mensagens com mais de 14 dias.");
        }
    },

    // Execução via Slash Command (/clear)
    async executeSlash(interaction: ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('quantidade', true);
        const channel = interaction.channel as TextChannel;

        // Verificação básica de canal
        if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
            return interaction.reply({ content: '❌ Comando inválido neste canal.', ephemeral: true });
        }

        try {
            const deleted = await channel.bulkDelete(amount, true);
            
            // Resposta invisível (ephemeral) para não sujar o chat de novo
            await interaction.reply({ 
                content: `🧹 **Sucesso!** Apaguei ${deleted.size} mensagens neste canal.`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: '❌ Erro ao apagar. Mensagens com mais de 14 dias não podem ser apagadas em massa pelo Discord.', 
                ephemeral: true 
            });
        }
    }
};